import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { LifecycleBadge, OperationBadge } from '@/components/labels'
import { PROPERTIES, type Lifecycle, type Property } from '@/lib/mock/data'

const LIFECYCLES: Lifecycle[] = ['draft', 'published', 'paused', 'sold', 'rejected']
const EXPIRY_WINDOW_MS = 3 * 86_400_000

/** A.7 — the one action this listing needs, without opening the detail. */
function InlineAction({ property }: { property: Property }) {
  const { t } = useI18n()

  if (property.lifecycle === 'rejected') return <Button>{t('properties.inlineFix')}</Button>
  if (property.lifecycle === 'paused') return <Button>{t('properties.inlinePublish')}</Button>
  if (property.unansweredLeads > 0) {
    return (
      <Link to={`/properties/${property.code}`}>
        <Button>{t('properties.inlineLeads', { count: property.unansweredLeads })}</Button>
      </Link>
    )
  }
  if (property.featuredExpiresAt !== null) {
    const days = Math.max(
      0,
      Math.ceil((new Date(property.featuredExpiresAt).getTime() - Date.now()) / 86_400_000),
    )
    if (days * 86_400_000 < EXPIRY_WINDOW_MS) {
      return <Button variant="primary">{t('properties.inlineRenew', { days })}</Button>
    }
  }
  return null
}

export function PropertiesPage() {
  const { t, formatCurrency, formatNumber } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [compact, setCompact] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const status = params.get('status')
  const leadsFilter = params.get('leads')
  const featuredFilter = params.get('featured')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PROPERTIES.filter((property) => {
      if (status !== null && property.lifecycle !== status) return false
      if (leadsFilter === 'unanswered' && property.unansweredLeads === 0) return false
      if (featuredFilter === 'expiring') {
        if (property.featuredExpiresAt === null) return false
        if (new Date(property.featuredExpiresAt).getTime() - Date.now() >= EXPIRY_WINDOW_MS) {
          return false
        }
      }
      if (needle === '') return true
      return (
        property.title.toLowerCase().includes(needle) ||
        property.city.toLowerCase().includes(needle) ||
        property.code.toLowerCase().includes(needle)
      )
    })
  }, [query, status, leadsFilter, featuredFilter])

  const setStatus = (next: Lifecycle | null) => {
    const updated = new URLSearchParams(params)
    if (next === null) updated.delete('status')
    else updated.set('status', next)
    updated.delete('leads')
    updated.delete('featured')
    setParams(updated, { replace: true })
    setSelected(new Set())
  }

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allShown = filtered.length > 0 && filtered.every((property) => selected.has(property.id))
  const rowPadding = compact ? 'py-1.5' : 'py-3'

  return (
    <>
      <PageHeader
        title={t('properties.title')}
        subtitle={t('common.resultCount', { count: filtered.length })}
        actions={
          <div className="flex items-center gap-1" role="group" aria-label={t('properties.density')}>
            <button
              type="button"
              aria-pressed={compact}
              onClick={() => setCompact(true)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                compact ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('properties.densityCompact')}
            </button>
            <button
              type="button"
              aria-pressed={!compact}
              onClick={() => setCompact(false)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                !compact ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('properties.densityComfortable')}
            </button>
          </div>
        }
      />
      <MockNotice>{t('mock.notice', { milestone: 'A.1 – A.8' })}</MockNotice>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor="property-search" className="sr-only">
          {t('common.search')}
        </label>
        <input
          id="property-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('properties.searchPlaceholder')}
          className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setStatus(null)}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              status === null ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t('common.all')}
          </button>
          {LIFECYCLES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                status === option ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(`lifecycle.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {/* A.4 — the bulk bar only exists while something is selected. */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-sm font-medium text-brand-800">
            {t('common.selectedCount', { count: selected.size })}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button>{t('properties.bulkPublish')}</Button>
            <Button>{t('properties.bulkPause')}</Button>
            <Button>{t('properties.bulkFeature')}</Button>
            <Button>{t('properties.bulkSold')}</Button>
            {/* Destructive: confirmation lands with the real endpoint. */}
            <Button className="!border-red-300 !text-red-700 hover:!bg-red-50">
              {t('properties.bulkDelete')}
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={t('properties.empty')} hint={t('properties.emptyHint')} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allShown}
                    aria-label={t('common.all')}
                    onChange={() =>
                      setSelected(allShown ? new Set() : new Set(filtered.map((p) => p.id)))
                    }
                  />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">{t('properties.title')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('common.status')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('common.price')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('propertyDetail.specs')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('common.leads')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((property) => (
                <tr key={property.id} className="hover:bg-slate-50">
                  <td className={`px-3 ${rowPadding}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(property.id)}
                      onChange={() => toggle(property.id)}
                      aria-label={property.title}
                    />
                  </td>
                  <td className={`px-3 ${rowPadding}`}>
                    <Link
                      to={`/properties/${property.code}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {property.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {property.code} · {property.sector}
                    </p>
                  </td>
                  <td className={`px-3 ${rowPadding}`}>
                    <div className="flex flex-wrap items-center gap-1">
                      <LifecycleBadge lifecycle={property.lifecycle} />
                      <OperationBadge operation={property.operation} />
                      {property.featured && <Badge tone="warning">★</Badge>}
                    </div>
                  </td>
                  <td className={`px-3 tabular-nums text-slate-800 ${rowPadding}`}>
                    {formatCurrency(property.price)}
                  </td>
                  {/* A.3 — specs live on the row, no drill-down to compare. */}
                  <td className={`px-3 text-xs tabular-nums text-slate-500 ${rowPadding}`}>
                    {property.bedrooms}h · {property.bathrooms}b · {property.parking}p ·{' '}
                    {formatNumber(property.area)} m²
                  </td>
                  <td className={`px-3 ${rowPadding}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="tabular-nums text-slate-700">{property.leadsCount}</span>
                      {property.unansweredLeads > 0 && (
                        <Badge tone="danger">{property.unansweredLeads}</Badge>
                      )}
                    </span>
                  </td>
                  <td className={`px-3 ${rowPadding}`}>
                    <InlineAction property={property} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
