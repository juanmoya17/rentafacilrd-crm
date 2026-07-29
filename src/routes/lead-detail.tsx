import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  ScoreDot,
} from '@/components/ui'
import { RecordHeader, RecordSectionHead } from '@/components/record'
import { OriginBadge, StageBadge } from '@/components/labels'
import { useToast } from '@/lib/toast-context'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { addActivity, getLead, updateLeadStage } from '@/lib/crm/api'
import { STAGES, type ActivityType, type CrmLead, type Stage } from '@/lib/crm/types'

const ACTIVITY_TYPES: ActivityType[] = ['message', 'call', 'visit', 'note']

export function LeadDetailPage() {
  const { id } = useParams()
  const leadId = Number(id)
  const { t, formatDate, formatRelativeTime } = useI18n()
  const toast = useToast()
  const reveal = useRowReveal()

  const resource = useResource((signal) => getLead(leadId, signal), [leadId])
  const [lead, setLead] = useState<CrmLead | null>(null)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setLead(loaded)
  }, [loaded])

  const [type, setType] = useState<ActivityType>('message')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  if (resource.status === 'loading') return <LoadingState label={t('common.loading')} />

  if (resource.status === 'error') {
    return (
      <ErrorState
        message={resource.message}
        retryLabel={t('common.retry')}
        onRetry={resource.reload}
      />
    )
  }

  if (lead === null) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={
          <Link to="/leads" viewTransition>
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    )
  }

  const changeStage = async (next: Stage) => {
    const previous = lead.stage
    setLead({ ...lead, stage: next })
    try {
      setLead(await updateLeadStage(lead.id, next))
    } catch (error: unknown) {
      // The badge and the select both snap back on their own; without the toast
      // that reads as the control refusing the click.
      setLead({ ...lead, stage: previous })
      toast.fail(error instanceof Error ? error.message : t('error.generic'), {
        label: t('common.retry'),
        run: () => void changeStage(next),
      })
    }
  }

  const submitActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      // The response carries the refreshed lead, so the SLA badge and the
      // timeline update together instead of drifting apart.
      setLead(await addActivity(lead.id, { type, body: body.trim() || undefined }))
      setBody('')
    } catch (error: unknown) {
      toast.fail(error instanceof Error ? error.message : t('error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const activities = lead.activities ?? []
  const tasks = lead.tasks ?? []

  return (
    <>
      <RecordHeader
        backTo="/leads"
        title={lead.contact?.name ?? '—'}
        subtitle={[lead.contact?.phone, lead.contact?.email].filter(Boolean).join(' · ')}
        badges={
          <>
            <StageBadge stage={lead.stage} />
            <OriginBadge origin={lead.origin} />
            {lead.score_band != null && (
              <span className="inline-flex items-center gap-1.5 rounded bg-surface-sunken px-1.5 py-0.5">
                <ScoreDot score={lead.score} band={lead.score_band} />
                <span className="text-xs text-ink-2">{t(`band.${lead.score_band}`)}</span>
              </span>
            )}
            {lead.is_sla_breached && (
              <Badge tone="danger">
                {t('common.sla')} · {t('common.overdue')}
              </Badge>
            )}
          </>
        }
        actions={
          /* Keyboard-accessible counterpart to dragging on the board. */
          <div className="flex items-center gap-2">
            <label htmlFor="stage" className="text-xs text-muted">
              {t('leadDetail.stage')}
            </label>
            <select
              id="stage"
              value={lead.stage}
              onChange={(event) => void changeStage(event.target.value as Stage)}
              className="min-h-9 rounded-md border border-rule-2 bg-surface-raised px-2 py-1 text-sm text-ink transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken"
            >
              {STAGES.map((option) => (
                <option key={option} value={option}>
                  {t(`stage.${option}`)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecordSectionHead label={t('leadDetail.timeline')} count={activities.length} />

          <Card className="mb-3 p-3">
            <form onSubmit={(event) => void submitActivity(event)}>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="activity-type" className="block text-sm font-medium text-ink-2">
                    {t('leadDetail.activityType')}
                  </label>
                  <select
                    id="activity-type"
                    value={type}
                    onChange={(event) => setType(event.target.value as ActivityType)}
                    className="mt-1 min-h-9 rounded-md border border-rule-2 bg-surface-raised px-2 py-1.5 text-sm text-ink transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken"
                  >
                    {ACTIVITY_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {t(`activity.${option}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0 flex-1">
                  <Field
                    id="activity-body"
                    label={t('leadDetail.activityBody')}
                    value={body}
                    onChange={setBody}
                    placeholder={t('leadDetail.activityPlaceholder')}
                    helper={t('leadDetail.noteHint')}
                    state={saving ? 'loading' : 'idle'}
                  />
                </div>

                <Button type="submit" variant="primary" state={saving ? 'loading' : 'idle'}>
                  {saving ? t('common.saving') : t('leadDetail.saveActivity')}
                </Button>
              </div>
            </form>
          </Card>

          {activities.length === 0 ? (
            <EmptyState title={t('leadDetail.emptyTimeline')} />
          ) : (
            /* A spine down the left edge turns a stack of cards into a
               chronology — the one thing a timeline has to communicate. */
            <ol className="relative space-y-2 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-rule">
              <AnimatePresence initial={false}>
                {activities.map((activity, index) => (
                  <motion.li
                    key={activity.id}
                    layout
                    {...reveal(index)}
                    exit={{ opacity: 0, y: -4 }}
                    className="relative pl-6"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-3.5 left-1 size-[7px] rounded-full bg-accent ring-2 ring-surface"
                    />
                    <Card className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="brand">{t(`activity.${activity.type}`)}</Badge>
                        {activity.occurred_at !== null && (
                          <time
                            dateTime={activity.occurred_at}
                            className="font-mono text-xs text-muted"
                          >
                            {formatRelativeTime(activity.occurred_at)}
                          </time>
                        )}
                      </div>
                      {activity.body !== null && (
                        <p className="mt-2 text-sm text-ink-2">{activity.body}</p>
                      )}
                    </Card>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <RecordSectionHead label={t('leadDetail.property')} />
            <Card className="p-3">
              {lead.property_title === null ? (
                <p className="text-sm text-muted">{t('common.none')}</p>
              ) : (
                <p className="text-sm font-medium text-ink">{lead.property_title}</p>
              )}
            </Card>
          </div>

          <div>
            <RecordSectionHead label={t('leadDetail.tasks')} count={tasks.length} />
            {tasks.length === 0 ? (
              <Card className="px-3 py-4 text-sm text-muted">{t('tasks.empty')}</Card>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task, index) => (
                  <motion.li key={task.id} {...reveal(index)}>
                    <Card className="p-3">
                      <p className="text-sm text-ink-2">{task.title}</p>
                      {task.due_at !== null && (
                        <p className="mt-1 font-mono text-xs text-muted">
                          {t('common.due')} {formatDate(task.due_at)}
                        </p>
                      )}
                    </Card>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
