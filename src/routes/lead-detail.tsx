import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ScoreDot,
} from '@/components/ui'
import { OriginBadge, StageBadge } from '@/components/labels'
import { useResource } from '@/lib/use-resource'
import { addActivity, getLead, updateLeadStage } from '@/lib/crm/api'
import {
  STAGES,
  type ActivityType,
  type CrmLead,
  type Stage,
} from '@/lib/crm/types'

const ACTIVITY_TYPES: ActivityType[] = ['message', 'call', 'visit', 'note']

export function LeadDetailPage() {
  const { id } = useParams()
  const leadId = Number(id)
  const { t, formatDate, formatRelativeTime } = useI18n()

  const resource = useResource((signal) => getLead(leadId, signal), [leadId])
  const [lead, setLead] = useState<CrmLead | null>(null)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setLead(loaded)
  }, [loaded])

  const [type, setType] = useState<ActivityType>('message')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
        action={<Link to="/leads"><Button>{t('common.back')}</Button></Link>}
      />
    )
  }

  const changeStage = async (next: Stage) => {
    setActionError(null)
    const previous = lead.stage
    setLead({ ...lead, stage: next })
    try {
      setLead(await updateLeadStage(lead.id, next))
    } catch (error: unknown) {
      setLead({ ...lead, stage: previous })
      setActionError(error instanceof Error ? error.message : t('error.generic'))
    }
  }

  const submitActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setActionError(null)
    try {
      // The response carries the refreshed lead, so the SLA badge and the
      // timeline update together instead of drifting apart.
      setLead(await addActivity(lead.id, { type, body: body.trim() || undefined }))
      setBody('')
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : t('error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const activities = lead.activities ?? []
  const tasks = lead.tasks ?? []

  return (
    <>
      <Link to="/leads" className="mb-3 inline-block text-sm text-brand-700 hover:underline">
        ← {t('common.back')}
      </Link>

      <PageHeader
        title={lead.contact?.name ?? '—'}
        subtitle={[lead.contact?.phone, lead.contact?.email].filter(Boolean).join(' · ')}
      />

      {actionError && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StageBadge stage={lead.stage} />
        <OriginBadge origin={lead.origin} />
        {lead.score_band != null && (
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-1.5 py-0.5">
            <ScoreDot score={lead.score} band={lead.score_band} />
            <span className="text-xs text-slate-600">{t(`band.${lead.score_band}`)}</span>
          </span>
        )}
        {lead.is_sla_breached && (
          <Badge tone="danger">
            {t('common.sla')} · {t('common.overdue')}
          </Badge>
        )}

        {/* Keyboard-accessible counterpart to dragging on the board. */}
        <label htmlFor="stage" className="ml-auto text-xs text-slate-500">
          {t('leadDetail.stage')}
        </label>
        <select
          id="stage"
          value={lead.stage}
          onChange={(event) => void changeStage(event.target.value as Stage)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {STAGES.map((option) => (
            <option key={option} value={option}>
              {t(`stage.${option}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('leadDetail.timeline')}</h2>

          <Card className="mb-3 p-3">
            <form onSubmit={(event) => void submitActivity(event)}>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="activity-type" className="block text-xs text-slate-500">
                    {t('leadDetail.activityType')}
                  </label>
                  <select
                    id="activity-type"
                    value={type}
                    onChange={(event) => setType(event.target.value as ActivityType)}
                    className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    {ACTIVITY_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {t(`activity.${option}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0 flex-1">
                  <label htmlFor="activity-body" className="block text-xs text-slate-500">
                    {t('leadDetail.activityBody')}
                  </label>
                  <input
                    id="activity-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={t('leadDetail.activityPlaceholder')}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
                  />
                </div>

                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? t('common.saving') : t('leadDetail.saveActivity')}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t('leadDetail.noteHint')}</p>
            </form>
          </Card>

          {activities.length === 0 ? (
            <EmptyState title={t('leadDetail.emptyTimeline')} />
          ) : (
            <ol className="space-y-2">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="brand">{t(`activity.${activity.type}`)}</Badge>
                      {activity.occurred_at !== null && (
                        <time
                          dateTime={activity.occurred_at}
                          className="text-xs tabular-nums text-slate-400"
                        >
                          {formatRelativeTime(activity.occurred_at)}
                        </time>
                      )}
                    </div>
                    {activity.body !== null && (
                      <p className="mt-2 text-sm text-slate-700">{activity.body}</p>
                    )}
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              {t('leadDetail.property')}
            </h2>
            <Card className="p-3">
              {lead.property_title === null ? (
                <p className="text-sm text-slate-500">{t('common.none')}</p>
              ) : (
                <p className="text-sm font-medium text-slate-900">{lead.property_title}</p>
              )}
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('leadDetail.tasks')}</h2>
            {tasks.length === 0 ? (
              <Card className="px-3 py-4 text-sm text-slate-500">{t('tasks.empty')}</Card>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Card className="p-3">
                      <p className="text-sm text-slate-800">{task.title}</p>
                      {task.due_at !== null && (
                        <p className="mt-1 text-xs tabular-nums text-slate-500">
                          {t('common.due')} {formatDate(task.due_at)}
                        </p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
