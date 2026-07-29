import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { LEADS, TASKS } from '@/lib/mock/data'

export function TasksPage() {
  const { t, formatDate, formatRelativeTime } = useI18n()

  const pending = TASKS.filter((task) => !task.done)
  const completed = TASKS.filter((task) => task.done)

  const renderTask = (task: (typeof TASKS)[number]) => {
    const lead = LEADS.find((item) => item.id === task.leadId)
    const overdue = !task.done && new Date(task.dueAt).getTime() < Date.now()

    return (
      <li key={task.id}>
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <input
            type="checkbox"
            checked={task.done}
            readOnly
            aria-label={task.title}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {task.title}
            </p>
            {lead && (
              <Link
                to={`/leads/${lead.id}`}
                className="text-xs text-brand-700 hover:underline"
              >
                {lead.name}
              </Link>
            )}
          </div>
          {overdue && <Badge tone="danger">{t('common.overdue')}</Badge>}
          <time dateTime={task.dueAt} className="text-xs tabular-nums text-slate-500">
            {formatDate(task.dueAt)} · {formatRelativeTime(task.dueAt)}
          </time>
        </Card>
      </li>
    )
  }

  return (
    <>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} />
      <MockNotice>{t('mock.notice', { milestone: 'C.4 / D.5' })}</MockNotice>

      {pending.length === 0 && completed.length === 0 ? (
        <EmptyState title={t('tasks.empty')} hint={t('tasks.emptyHint')} />
      ) : (
        <>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {t('tasks.pending')} ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <Card className="px-3 py-4 text-sm text-slate-500">{t('tasks.empty')}</Card>
          ) : (
            <ul className="space-y-2">{pending.map(renderTask)}</ul>
          )}

          {completed.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-900">
                {t('tasks.completed')} ({completed.length})
              </h2>
              <ul className="space-y-2">{completed.map(renderTask)}</ul>
            </>
          )}
        </>
      )}
    </>
  )
}
