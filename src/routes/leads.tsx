import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, ScoreDot } from '@/components/ui'
import { FilterBar, Register, SearchField, Segmented, type Column } from '@/components/register'
import { OriginBadge, StageBadge } from '@/components/labels'
import { useRecordMorph } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { listLeads } from '@/lib/crm/api'
import { STAGES, type CrmLead, type Stage } from '@/lib/crm/types'

/**
 * The lead's name is the shared element: clicking it morphs into the heading on
 * the detail screen. The name is only attached while that specific navigation
 * is running, because a `view-transition-name` present on fifty rows at once is
 * a duplicate and silently kills the transition.
 */
function LeadName({ lead }: { lead: CrmLead }) {
  const to = `/leads/${lead.id}`
  const morph = useRecordMorph(to)
  const { t } = useI18n()

  return (
    <>
      <Link
        to={to}
        viewTransition
        style={morph}
        className="font-medium text-ink transition-colors duration-(--duration-fast) ease-out hover:text-brand-700"
      >
        {lead.contact?.name ?? '—'}
      </Link>
      <p className="font-mono text-xs text-muted">{lead.contact?.phone ?? t('common.none')}</p>
    </>
  )
}

export function LeadsPage() {
  const { t, formatRelativeTime } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(query)

  const stage = params.get('stage')
  const sla = params.get('sla')
  const propertyId = params.get('property_id')

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
          property_id: propertyId === null ? undefined : Number(propertyId),
          q: debounced.trim() === '' ? undefined : debounced.trim(),
          limit: 50,
        },
        signal,
      ),
    [stage, sla, propertyId, debounced],
  )

  const clearPropertyFilter = () => {
    const updated = new URLSearchParams(params)
    updated.delete('property_id')
    setParams(updated, { replace: true })
  }

  const setStage = (next: Stage | null) => {
    const updated = new URLSearchParams(params)
    if (next === null) updated.delete('stage')
    else updated.set('stage', next)
    updated.delete('sla')
    setParams(updated, { replace: true })
  }

  const toggleBreached = () => {
    const updated = new URLSearchParams(params)
    updated.delete('stage')
    if (sla === 'breached') updated.delete('sla')
    else updated.set('sla', 'breached')
    setParams(updated, { replace: true })
  }

  const total = resource.status === 'ready' ? resource.data.total : undefined

  const columns: Column<CrmLead>[] = [
    {
      key: 'lead',
      header: t('leads.title'),
      card: 'primary',
      render: (lead) => <LeadName lead={lead} />,
    },
    {
      key: 'score',
      header: t('common.score'),
      numeric: true,
      render: (lead) => <ScoreDot score={lead.score} band={lead.score_band} />,
    },
    {
      key: 'stage',
      header: t('common.status'),
      render: (lead) => <StageBadge stage={lead.stage} />,
    },
    {
      key: 'origin',
      header: t('common.origin'),
      render: (lead) => <OriginBadge origin={lead.origin} />,
    },
    {
      key: 'property',
      header: t('leadDetail.property'),
      render: (lead) => lead.property_title ?? t('common.none'),
    },
    {
      key: 'sla',
      header: t('common.sla'),
      numeric: true,
      render: (lead) => (
        <span className={lead.is_sla_breached ? 'font-semibold text-error' : 'text-muted'}>
          {lead.sla_due_at !== null
            ? formatRelativeTime(lead.sla_due_at)
            : lead.last_activity_at !== null
              ? formatRelativeTime(lead.last_activity_at)
              : '—'}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('leads.title')}
        actions={
          <Link to="/pipeline" viewTransition>
            <Button>{t('leads.kanbanView')}</Button>
          </Link>
        }
      />

      <FilterBar>
        <SearchField
          id="lead-search"
          label={t('common.search')}
          value={query}
          onChange={setQuery}
          placeholder={t('leads.searchPlaceholder')}
          resultLabel={
            total === undefined ? undefined : t('common.resultCount', { count: total })
          }
          pending={query !== debounced}
        />

        <Segmented
          group="lead-stage"
          label={t('common.status')}
          value={sla === 'breached' ? null : (stage as Stage | null)}
          onChange={setStage}
          options={[
            { value: null, label: t('common.all') },
            ...STAGES.map((option) => ({ value: option, label: t(`stage.${option}`) })),
          ]}
        />

        {/* A separate axis from stage, so it is a toggle rather than a segment —
            folding it into the group would imply it is one of the stages. */}
        <button
          type="button"
          aria-pressed={sla === 'breached'}
          onClick={toggleBreached}
          className={`min-h-9 whitespace-nowrap rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-(--duration-fast) ease-out active:translate-y-px ${
            sla === 'breached'
              ? 'border-error bg-error text-white'
              : 'border-rule-2 text-error hover:bg-error-bg'
          }`}
        >
          {t('common.sla')} · {t('common.overdue')}
        </button>

        {/* property_id has no widget of its own (unlike stage/sla above) — it
            only ever arrives via a link from the properties screen — so this
            is the one affordance that shows it is active and lets it be
            cleared, same border/pill styling the sla toggle uses. */}
        {propertyId !== null && (
          <button
            type="button"
            onClick={clearPropertyFilter}
            className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-rule-2 px-2.5 py-1 text-sm font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken active:translate-y-px"
          >
            {t('leads.filteredByProperty')}
            <span aria-hidden="true">×</span>
          </button>
        )}
      </FilterBar>

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
          <Register
            label={t('leads.title')}
            columns={columns}
            rows={resource.data.items}
            rowKey={(lead) => lead.id}
          />
        ))}
    </>
  )
}
