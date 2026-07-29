import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MockNotice,
  PageHeader,
  ScoreDot,
} from '@/components/ui'
import { OperationBadge, OriginBadge, StageBadge } from '@/components/labels'
import {
  ACTIVITIES,
  LEADS,
  PROPERTIES,
  TASKS,
  isSlaBreached,
  scoreBand,
} from '@/lib/mock/data'

export function LeadDetailPage() {
  const { id } = useParams()
  const { t, formatDate, formatRelativeTime, formatCurrency } = useI18n()

  const lead = LEADS.find((item) => String(item.id) === id)
  if (lead === undefined) {
    return <EmptyState title={t('error.notFound')} action={<Link to="/leads"><Button>{t('common.back')}</Button></Link>} />
  }

  const activities = ACTIVITIES.filter((item) => item.leadId === lead.id)
  const tasks = TASKS.filter((item) => item.leadId === lead.id)
  const property = PROPERTIES.find((item) => item.code === lead.propertyCode)
  const band = scoreBand(lead.score)

  return (
    <>
      <Link to="/leads" className="mb-3 inline-block text-sm text-brand-700 hover:underline">
        ← {t('common.back')}
      </Link>

      <PageHeader
        title={lead.name}
        subtitle={`${lead.phone} · ${lead.email}`}
        actions={<Button variant="primary">{t('leadDetail.reply')}</Button>}
      />
      <MockNotice>{t('mock.notice', { milestone: 'C.4 / C.5 / C.6 / D.1' })}</MockNotice>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StageBadge stage={lead.stage} />
        <OriginBadge origin={lead.origin} />
        <OperationBadge operation={lead.operation} />
        <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-1.5 py-0.5">
          <ScoreDot score={lead.score} band={band} />
          <span className="text-xs text-slate-600">{t(`band.${band}`)}</span>
        </span>
        {isSlaBreached(lead) && (
          <Badge tone="danger">
            {t('common.sla')} · {t('common.overdue')}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {t('leadDetail.timeline')}
          </h2>

          {activities.length === 0 ? (
            <EmptyState title={t('leadDetail.emptyTimeline')} />
          ) : (
            <ol className="space-y-2">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="brand">{t(`activity.${activity.type}`)}</Badge>
                      <time
                        dateTime={activity.at}
                        className="text-xs tabular-nums text-slate-400"
                      >
                        {formatRelativeTime(activity.at)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{activity.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex gap-2">
            <Button>{t('leadDetail.addNote')}</Button>
            <Button>{t('leadDetail.addTask')}</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              {t('leadDetail.property')}
            </h2>
            <Card className="p-3">
              {property === undefined ? (
                <p className="text-sm text-slate-500">{lead.propertyTitle}</p>
              ) : (
                <>
                  <Link
                    to={`/properties/${property.code}`}
                    className="text-sm font-medium text-slate-900 hover:text-brand-700"
                  >
                    {property.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {property.code} · {property.sector}, {property.city}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatCurrency(property.price)}
                  </p>
                </>
              )}
            </Card>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              {t('leadDetail.tasks')}
            </h2>
            {tasks.length === 0 ? (
              <Card className="px-3 py-4 text-sm text-slate-500">{t('tasks.empty')}</Card>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Card className="p-3">
                      <p className="text-sm text-slate-800">{task.title}</p>
                      <p className="mt-1 text-xs tabular-nums text-slate-500">
                        {t('common.due')} {formatDate(task.dueAt)}
                      </p>
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
