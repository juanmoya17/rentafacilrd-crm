import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { FilterBar } from '@/components/register'
import { useToast } from '@/lib/toast-context'
import { useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listTasks, setTaskDone, type TaskFilters } from '@/lib/crm/api'
import type { CrmTask } from '@/lib/crm/types'

/**
 * An unrecognised `status` (a stale bookmark, a hand-edited URL) falls back
 * to no filter rather than reaching the server as-is — same guard
 * properties.tsx uses for `lifecycle` and leads.tsx uses for `stage`.
 */
function statusFromParam(raw: string | null): TaskFilters['status'] {
  return raw === 'pending' || raw === 'done' || raw === 'overdue' ? raw : undefined
}

export function TasksPage() {
  const { t, formatDate, formatRelativeTime } = useI18n()
  const toast = useToast()
  const reveal = useRowReveal()
  const [params, setParams] = useSearchParams()
  // The A.6 rail's `overdue_tasks` bucket lands here via ?status=overdue —
  // without reading it, that link showed every task instead of the filtered
  // subset the bucket's count promised.
  const status = statusFromParam(params.get('status'))
  const resource = useResource((signal) => listTasks({ limit: 100, status }, signal), [status])

  // Same affordance leads.tsx uses for property_id: status has no filter
  // widget of its own here (unlike leads.tsx's stage/sla), and only ever
  // arrives via a link (the rail) — without this, landing on a filtered
  // list with no sign it is filtered reads as "I only have one task".
  const clearStatusFilter = () => {
    const updated = new URLSearchParams(params)
    updated.delete('status')
    setParams(updated, { replace: true })
  }

  const [tasks, setTasks] = useState<CrmTask[]>([])

  const loaded = resource.status === 'ready' ? resource.data : null
  useEffect(() => {
    if (loaded !== null) setTasks(loaded.items)
  }, [loaded])

  const toggle = async (task: CrmTask) => {
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
      // The row has already jumped back to the other list, which on its own
      // looks like the app glitched. The toast is what makes the rollback
      // legible — and it offers the retry rather than just reporting.
      toast.fail(caught instanceof Error ? caught.message : t('error.generic'), {
        label: t('common.retry'),
        run: () => void toggle(task),
      })
    }
  }

  const pending = tasks.filter((task) => !task.is_done)
  const completed = tasks.filter((task) => task.is_done)

  const renderTask = (task: CrmTask, index: number) => (
    <motion.li
      key={task.id}
      /* `layout` is what makes a checked task travel down to Completed instead
         of vanishing here and reappearing there — the movement is the receipt
         for the action, which is why this screen needs no success toast. */
      layout
      {...reveal(index)}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="flex flex-wrap items-center gap-3 p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2">
        <input
          type="checkbox"
          checked={task.is_done}
          onChange={() => void toggle(task)}
          aria-label={task.title}
          className="size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm transition-colors duration-(--duration-base) ease-out ${
              task.is_done ? 'text-muted line-through' : 'text-ink-2'
            }`}
          >
            {task.title}
          </p>
          {task.lead_id !== null && (
            <Link
              to={`/leads/${task.lead_id}`}
              viewTransition
              className="font-mono text-xs text-brand-700 hover:underline"
            >
              {t('nav.leads')} #{task.lead_id}
            </Link>
          )}
        </div>
        {!task.is_done && task.is_overdue && <Badge tone="danger">{t('common.overdue')}</Badge>}
        {task.due_at !== null && (
          <time dateTime={task.due_at} className="font-mono text-xs text-muted">
            {formatDate(task.due_at)} · {formatRelativeTime(task.due_at)}
          </time>
        )}
      </Card>
    </motion.li>
  )

  return (
    <>
      <PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} />

      {status !== undefined && (
        <FilterBar>
          <button
            type="button"
            onClick={clearStatusFilter}
            aria-label={t('tasks.clearStatusFilter')}
            className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-rule-2 px-2.5 py-1 text-sm font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken active:translate-y-px"
          >
            {t('tasks.filteredByStatus')}
            <span aria-hidden="true">×</span>
          </button>
        </FilterBar>
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
            <SectionHead label={t('tasks.pending')} count={pending.length} />
            {pending.length === 0 ? (
              <Card className="px-3 py-4 text-sm text-muted">{t('tasks.empty')}</Card>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>{pending.map(renderTask)}</AnimatePresence>
              </ul>
            )}

            {completed.length > 0 && (
              <>
                <div className="mt-6">
                  <SectionHead label={t('tasks.completed')} count={completed.length} />
                </div>
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>{completed.map(renderTask)}</AnimatePresence>
                </ul>
              </>
            )}
          </>
        ))}
    </>
  )
}

/** Count sits in mono beside the label, so the two lists compare at a glance. */
function SectionHead({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="font-mono text-xs text-muted">{count}</span>
    </h2>
  )
}
