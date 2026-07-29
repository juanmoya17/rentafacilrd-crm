import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { listTasks, setTaskDone } from '@/lib/crm/api'
import type { CrmTask } from '@/lib/crm/types'

export function TasksPage() {
  const { t, formatDate, formatRelativeTime } = useI18n()
  const resource = useResource((signal) => listTasks({ limit: 100 }, signal), [])

  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [error, setError] = useState<string | null>(null)

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setTasks(loaded.items)
  }, [loaded])

  const toggle = async (task: CrmTask) => {
    setError(null)
    // Optimistic: the checkbox responds now, and reverts if the server refuses.
    const next = !task.is_done
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, is_done: next } : item)),
    )
    try {
      const updated = await setTaskDone(task.id, next)
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)))
    } catch (caught: unknown) {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, is_done: task.is_done } : item)),
      )
      setError(caught instanceof Error ? caught.message : t('error.generic'))
    }
  }

  const pending = tasks.filter((task) => !task.is_done)
  const completed = tasks.filter((task) => task.is_done)

  const renderTask = (task: CrmTask) => (
    <li key={task.id}>
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={task.is_done}
          onChange={() => void toggle(task)}
          aria-label={task.title}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${task.is_done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {task.lead_id !== null && (
            <Link to={`/leads/${task.lead_id}`} className="text-xs text-brand-700 hover:underline">
              {t('nav.leads')} #{task.lead_id}
            </Link>
          )}
        </div>
        {!task.is_done && task.is_overdue && <Badge tone="danger">{t('common.overdue')}</Badge>}
        {task.due_at !== null && (
          <time dateTime={task.due_at} className="text-xs tabular-nums text-slate-500">
            {formatDate(task.due_at)} · {formatRelativeTime(task.due_at)}
          </time>
        )}
      </Card>
    </li>
  )

  return (
    <>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} />

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}

      {resource.status === 'error' && (
        <ErrorState
          message={resource.message}
          retryLabel={t('common.retry')}
          onRetry={resource.reload}
        />
      )}

      {resource.status === 'ready' &&
        (tasks.length === 0 ? (
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
        ))}
    </>
  )
}
