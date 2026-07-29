import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, EmptyState, MockNotice, PageHeader } from '@/components/ui'
import { FilterBar, Register, SearchField, Segmented, type Column } from '@/components/register'
import { LifecycleBadge, OperationBadge } from '@/components/labels'
import { useRecordMorph } from '@/lib/motion'
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
      <Link to={`/properties/${property.code}`} viewTransition>
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

function PropertyName({ property }: { property: Property }) {
  const to = `/properties/${property.code}`
  const morph = useRecordMorph(to)

  return (
    <Link
      to={to}
      viewTransition
      style={morph}
      className="font-medium text-ink transition-colors duration-(--duration-fast) ease-out hover:text-brand-700"
    >
      {property.title}
    </Link>
  )
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

  const columns: Column<Property>[] = [
    {
      key: 'select',
      header: '',
      // Desktop-only: the card layout selects by tapping, so a checkbox column
      // there would be a second way to do one thing.
      card: 'hide',
      render: (property) => (
        <input
          type="checkbox"
          checked={selected.has(property.id)}
          onChange={() => toggle(property.id)}
          aria-label={property.title}
          className="accent-[var(--color-accent)]"
        />
      ),
    },
    {
      key: 'title',
      header: t('properties.title'),
      card: 'primary',
      render: (property) => <PropertyName property={property} />,
    },
    {
      key: 'code',
      header: t('properties.title'),
      card: 'meta',
      render: (property) => (
        <span className="font-mono">
          {property.code} · {property.sector}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (property) => (
        <div className="flex flex-wrap items-center gap-1">
          <LifecycleBadge lifecycle={property.lifecycle} />
          <OperationBadge operation={property.operation} />
          {property.featured && <Badge tone="warning">★</Badge>}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('common.price'),
      numeric: true,
      render: (property) => <span className="text-ink">{formatCurrency(property.price)}</span>,
    },
    {
      key: 'specs',
      header: t('propertyDetail.specs'),
      numeric: true,
      // A.3 — specs live on the row, no drill-down to compare.
      render: (property) => (
        <span className="text-xs text-muted">
          {property.bedrooms}h · {property.bathrooms}b · {property.parking}p ·{' '}
          {formatNumber(property.area)} m²
        </span>
      ),
    },
    {
      key: 'leads',
      header: t('common.leads'),
      numeric: true,
      render: (property) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="text-ink-2">{property.leadsCount}</span>
          {property.unansweredLeads > 0 && (
            <Badge tone="danger">{property.unansweredLeads}</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (property) => <InlineAction property={property} />,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('properties.title')}
        actions={
          <Segmented
            group="property-density"
            label={t('properties.density')}
            value={compact ? 'compact' : 'comfortable'}
            onChange={(next) => setCompact(next !== 'comfortable')}
            options={[
              { value: 'compact', label: t('properties.densityCompact') },
              { value: 'comfortable', label: t('properties.densityComfortable') },
            ]}
          />
        }
      />
      <MockNotice>{t('mock.notice', { milestone: 'A.1 – A.8' })}</MockNotice>

      <FilterBar>
        <SearchField
          id="property-search"
          label={t('common.search')}
          value={query}
          onChange={setQuery}
          placeholder={t('properties.searchPlaceholder')}
          resultLabel={t('common.resultCount', { count: filtered.length })}
        />

        <Segmented
          group="property-status"
          label={t('common.status')}
          value={status as Lifecycle | null}
          onChange={setStatus}
          options={[
            { value: null, label: t('common.all') },
            ...LIFECYCLES.map((option) => ({
              value: option,
              label: t(`lifecycle.${option}`),
            })),
          ]}
        />

        <label className="ml-auto hidden items-center gap-1.5 text-sm text-muted lg:flex">
          <input
            type="checkbox"
            checked={allShown}
            onChange={() => setSelected(allShown ? new Set() : new Set(filtered.map((p) => p.id)))}
            className="accent-[var(--color-accent)]"
          />
          {t('common.all')}
        </label>
      </FilterBar>

      {/* A.4 — the bulk bar only exists while something is selected, and it
          slides rather than appears, so the table shifting down is explained. */}
      <AnimatePresence initial={false}>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2"
          >
            <span className="font-mono text-sm font-medium text-brand-800">
              {t('common.selectedCount', { count: selected.size })}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button>{t('properties.bulkPublish')}</Button>
              <Button>{t('properties.bulkPause')}</Button>
              <Button>{t('properties.bulkFeature')}</Button>
              <Button>{t('properties.bulkSold')}</Button>
              {/* Destructive: confirmation lands with the real endpoint. */}
              <Button className="!border-error !text-error hover:!bg-error-bg">
                {t('properties.bulkDelete')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <EmptyState title={t('properties.empty')} hint={t('properties.emptyHint')} />
      ) : (
        <Register
          label={t('properties.title')}
          columns={columns}
          rows={filtered}
          rowKey={(property) => property.id}
          density={compact ? 'compact' : 'comfortable'}
        />
      )}
    </>
  )
}
