import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ScoreDot,
} from '@/components/ui'
import { OriginBadge, StageBadge } from '@/components/labels'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { STAGES, type Stage } from '@/lib/crm/types'

export function LeadsPage() {
  const { t, formatRelativeTime } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(query)

  const stage = params.get('stage')
  const sla = params.get('sla')

  // Typing filters server-side, so wait for a pause instead of a request per key.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const resource = useResource(
    (signal) =>
      listLeads(
        {
          stage: (stage as Stage | null) ?? undefined,
          sla: sla === 'breached' ? 'breached' : undefined,
          q: debounced.trim() === '' ? undefined : debounced.trim(),
          limit: 50,
        },
        signal,
      ),
    [stage, sla, debounced],
  )

  const setStage = (next: Stage | null) => {
    const updated = new URLSearchParams(params)
    if (next === null) updated.delete('stage')
    else updated.set('stage', next)
    updated.delete('sla')
    setParams(updated, { replace: true })
  }

  const total = resource.status === 'ready' ? resource.data.total : undefined

  return (
    <>
      <PageHeader
        title={t('leads.title')}
        subtitle={total === undefined ? undefined : t('common.resultCount', { count: total })}
        actions={
          <Link
            to="/pipeline"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('leads.kanbanView')}
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor="lead-search" className="sr-only">
          {t('common.search')}
        </label>
        <input
          id="lead-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('leads.searchPlaceholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
        />

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStage(null)}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              stage === null && sla === null
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t('common.all')}
          </button>
          {STAGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStage(option)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                stage === option ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(`stage.${option}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const updated = new URLSearchParams(params)
              updated.delete('stage')
              updated.set('sla', 'breached')
              setParams(updated, { replace: true })
            }}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              sla === 'breached' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
            }`}
          >
            {t('common.sla')} · {t('common.overdue')}
          </button>
        </div>
      </div>

      {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}

      {resource.status === 'error' && (
        <ErrorState
          message={resource.message}
          retryLabel={t('common.retry')}
          onRetry={resource.reload}
        />
      )}

      {resource.status === 'ready' &&
        (resource.data.items.length === 0 ? (
          <EmptyState title={t('leads.empty')} hint={t('leads.emptyHint')} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t('leads.title')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('common.score')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('common.status')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('common.origin')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('leadDetail.property')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('common.sla')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resource.data.items.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {lead.contact?.name ?? '—'}
                      </Link>
                      <p className="text-xs text-slate-500">{lead.contact?.phone}</p>
                    </td>
                    <td className="px-3 py-2">
                      <ScoreDot score={lead.score} band={lead.score_band} />
                    </td>
                    <td className="px-3 py-2"><StageBadge stage={lead.stage} /></td>
                    <td className="px-3 py-2"><OriginBadge origin={lead.origin} /></td>
                    <td className="px-3 py-2 text-slate-600">
                      {lead.property_title ?? t('common.none')}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        lead.is_sla_breached ? 'font-semibold text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {lead.sla_due_at !== null
                        ? formatRelativeTime(lead.sla_due_at)
                        : lead.last_activity_at !== null
                          ? formatRelativeTime(lead.last_activity_at)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
    </>
  )
}
