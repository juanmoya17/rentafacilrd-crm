import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Card, EmptyState, MockNotice, PageHeader, ScoreDot } from '@/components/ui'
import { OperationBadge, OriginBadge, StageBadge } from '@/components/labels'
import { LEADS, isSlaBreached, scoreBand, type Stage } from '@/lib/mock/data'

const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'won', 'lost']

export function LeadsPage() {
  const { t, formatRelativeTime } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const stage = params.get('stage')
  const slaFilter = params.get('sla')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return LEADS.filter((lead) => {
      if (stage !== null && lead.stage !== stage) return false
      if (slaFilter === 'breached' && !isSlaBreached(lead)) return false
      if (needle === '') return true
      return (
        lead.name.toLowerCase().includes(needle) ||
        lead.phone.includes(needle) ||
        lead.propertyCode.toLowerCase().includes(needle)
      )
    })
  }, [query, stage, slaFilter])

  const setStage = (next: Stage | null) => {
    const updated = new URLSearchParams(params)
    if (next === null) updated.delete('stage')
    else updated.set('stage', next)
    updated.delete('sla')
    setParams(updated, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={t('leads.title')}
        subtitle={t('common.resultCount', { count: filtered.length })}
        actions={
          <Link
            to="/pipeline"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('leads.kanbanView')}
          </Link>
        }
      />
      <MockNotice>{t('mock.notice', { milestone: 'C.2 / C.3' })}</MockNotice>

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
              stage === null ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
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
        </div>
      </div>

      {filtered.length === 0 ? (
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
                <th scope="col" className="px-3 py-2 font-medium">{t('common.code')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('common.sla')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((lead) => {
                const breached = isSlaBreached(lead)
                return (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {lead.name}
                      </Link>
                      <p className="text-xs text-slate-500">{lead.phone}</p>
                    </td>
                    <td className="px-3 py-2">
                      <ScoreDot score={lead.score} band={scoreBand(lead.score)} />
                    </td>
                    <td className="px-3 py-2"><StageBadge stage={lead.stage} /></td>
                    <td className="px-3 py-2"><OriginBadge origin={lead.origin} /></td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-600">{lead.propertyCode}</span>
                        <OperationBadge operation={lead.operation} />
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        breached ? 'font-semibold text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {lead.slaDueAt === null
                        ? formatRelativeTime(lead.lastActivityAt)
                        : formatRelativeTime(lead.slaDueAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
