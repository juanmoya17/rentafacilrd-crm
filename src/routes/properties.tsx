import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { FilterBar, Register, SearchField, Segmented, type Column } from '@/components/register'
import { LifecycleBadge, ModerationBadge, OperationBadge } from '@/components/labels'
import { KpiStrip } from '@/components/kpi-strip'
import { BulkBar } from '@/components/bulk-bar'
import { ActionRail } from '@/components/action-rail'
import { useRecordMorph } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { useToast } from '@/lib/toast-context'
import {
  classifyBatchError,
  formatSpecs,
  getActionRail,
  getPropertySummary,
  listProperties,
  messageFor,
  propertyParams,
  PROPERTY_SORTS,
  runBatch,
  type PropertyFilters,
  type PropertySort,
} from '@/lib/crm/properties'
import { LIFECYCLES, MAX_BATCH, type CrmProperty, type Lifecycle } from '@/lib/crm/types'

const PAGE_SIZE = 30
const EXPIRY_WINDOW_MS = 3 * 86_400_000

/**
 * URL -> filters. An unrecognised `lifecycle` or `sort` (a stale bookmark)
 * falls back to undefined rather than erroring — the same philosophy
 * PropertyListQuery::sort() uses server-side, where an unknown sort shows a
 * list instead of a 422.
 */
function filtersFromParams(params: URLSearchParams): PropertyFilters {
  const num = (key: string): number | undefined => {
    const raw = params.get(key)
    if (raw === null || raw === '') return undefined
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
  }

  const lifecycle = params.get('lifecycle')
  const sort = params.get('sort')
  const featured = params.get('is_featured')
  const featuredExpiring = params.get('featured_expiring')

  return {
    search: params.get('search') ?? undefined,
    lifecycle: LIFECYCLES.includes(lifecycle as Lifecycle) ? (lifecycle as Lifecycle) : undefined,
    sort: PROPERTY_SORTS.includes(sort as PropertySort) ? (sort as PropertySort) : undefined,
    is_featured: featured === null ? undefined : featured === 'true',
    featured_expiring: featuredExpiring === null ? undefined : featuredExpiring === 'true',
    city_id: num('city_id'),
    price_min: num('price_min'),
    price_max: num('price_max'),
    area_min: num('area_min'),
    area_max: num('area_max'),
    // Clamped the way the server already clamps its own offset — a negative
    // value would otherwise reach the API and make the pager range read "−4–…".
    offset: Math.max(0, num('offset') ?? 0),
    limit: PAGE_SIZE,
  }
}

/** A.7 — the one action this listing needs, without opening the detail. */
function InlineAction({
  property,
  onPublish,
}: {
  property: CrmProperty
  onPublish: (id: number) => void
}) {
  const { t } = useI18n()

  if (property.lifecycle === 'rejected') return <Button>{t('properties.inlineFix')}</Button>
  if (property.lifecycle === 'paused') {
    return <Button onClick={() => onPublish(property.id)}>{t('properties.inlinePublish')}</Button>
  }
  if (property.unanswered_leads > 0) {
    // LeadFilters already accepts property_id, so this lands on the filtered
    // lead list the button's label promises — not the listing's own detail
    // page (that link is PropertyName's job, on the title column).
    return (
      <Link to={`/leads?property_id=${property.id}`} viewTransition>
        <Button>{t('properties.inlineLeads', { count: property.unanswered_leads })}</Button>
      </Link>
    )
  }
  if (property.featured_expires_at !== null) {
    // Compare the raw remainder, not the rounded display value — rounding
    // first (e.g. 2.1 days -> ceil -> 3) made the window effectively <=2
    // days instead of the intended <3.
    const remaining = new Date(property.featured_expires_at).getTime() - Date.now()
    if (remaining < EXPIRY_WINDOW_MS) {
      const days = Math.max(0, Math.ceil(remaining / 86_400_000))
      return <Button variant="primary">{t('properties.inlineRenew', { days })}</Button>
    }
  }
  return null
}

function PropertyName({ property }: { property: CrmProperty }) {
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

/** Offset pager. One component, used in the desktop `<tfoot>` and the mobile fallback. */
function Pager({
  offset,
  total,
  itemsCount,
  onOffsetChange,
}: {
  offset: number
  total: number
  itemsCount: number
  onOffsetChange: (nextOffset: number) => void
}) {
  const { t } = useI18n()
  // itemsCount, not total: an offset beyond the result set (the last page
  // shrank, or a stale ?offset=N bookmark) shows 0 items even though total
  // is nonzero — "61–9 of 9" would otherwise read as nonsense.
  const from = itemsCount === 0 ? 0 : offset + 1
  const to = Math.min(offset + itemsCount, total)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-xs text-muted">{t('pager.range', { from, to, total })}</span>
      <div className="flex gap-1.5">
        <Button
          disabled={offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
        >
          {t('pager.previous')}
        </Button>
        <Button disabled={to >= total} onClick={() => onOffsetChange(offset + PAGE_SIZE)}>
          {t('pager.next')}
        </Button>
      </div>
    </div>
  )
}

export function PropertiesPage() {
  const { t, formatCurrency, formatNumber } = useI18n()
  const { fail } = useToast()
  const [params, setParams] = useSearchParams()
  const [compact, setCompact] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // URL is the single source of filter truth — no filter is ever mirrored
  // into useState, or the two would drift.
  const filters = useMemo(() => filtersFromParams(params), [params])
  const serializedFilters = JSON.stringify(propertyParams(filters))

  // Local mirror ONLY for the text input, so typing stays responsive. The URL
  // remains the source of truth; this catches up to it 300ms later.
  const [draftSearch, setDraftSearch] = useState(filters.search ?? '')

  // The search value this component itself last wrote to the URL. Lets the
  // sync effect below tell "the URL changed because our own debounce just
  // committed" apart from "the URL changed for some other reason" — without
  // it, a keystroke typed in the gap between the timer firing and the URL
  // update reaching that effect gets silently overwritten (dropped
  // character, caret jump).
  const lastCommittedSearch = useRef(filters.search ?? '')

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const updated = new URLSearchParams(params)
      if (value === null) updated.delete(key)
      else updated.set(key, value)
      // Any filter change invalidates the page cursor — otherwise page 4 of
      // the old result set silently shows an empty page 4 of the new one.
      if (key !== 'offset') updated.delete('offset')
      setParams(updated, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftSearch === (filters.search ?? '')) return
      lastCommittedSearch.current = draftSearch
      setParam('search', draftSearch === '' ? null : draftSearch)
    }, 300)
    return () => {
      clearTimeout(timer)
    }
  }, [draftSearch, filters.search, setParam])

  // Keeps the mirror caught up when the URL's search changes for a reason
  // other than this same debounce (a KPI shortcut replacing the filters, or
  // back/forward navigation) — otherwise the stale draft re-fires the timer
  // above and silently reinstates a search the user just navigated away from.
  // Skips when the change is the debounce's own commit landing, so a
  // keystroke typed just after that commit isn't clobbered.
  useEffect(() => {
    const next = filters.search ?? ''
    if (next === lastCommittedSearch.current) return
    lastCommittedSearch.current = next
    setDraftSearch(next)
  }, [filters.search])

  // A.5 — the screen owns this fetch, not the strip: Task 6's bulk bar reads
  // the same featured_balance, and a batch action has to refresh both the
  // rows and this summary through the one `reload` below.
  const summaryResource = useResource((signal) => getPropertySummary(signal), [])

  // A.6 — fetched unconditionally alongside the summary. Whether it renders
  // is a display decision (showChrome and total > 0, below); a batch action
  // can change any of the four bucket counts, so a bulk-bar success or a
  // stale (404) resync reloads this the same way it reloads the summary.
  const railResource = useResource((signal) => getActionRail(signal), [])

  // A.8 — the chrome grows with the inventory. Gate on the UNFILTERED total
  // (the summary's, not the filtered list's), so filtering down to two rows
  // never strips the controls being used to filter. 0 while the summary is
  // still loading — chrome appears a beat late rather than flashing early.
  const summaryTotal = summaryResource.status === 'ready' ? summaryResource.data.total : 0
  const showChrome = summaryTotal > 3

  const hasAdvancedFilters =
    filters.price_min !== undefined ||
    filters.price_max !== undefined ||
    filters.area_min !== undefined ||
    filters.area_max !== undefined ||
    filters.is_featured !== undefined

  // Bumped only on an external reset (this button, or a KPI shortcut) —
  // never by a field's own onBlur commit — so remounting the inputs to pick
  // up a fresh defaultValue never fights a Tab press or eats the click that
  // triggered the reset.
  const [advancedResetKey, setAdvancedResetKey] = useState(0)

  // The panel's open state belongs to the user from here on, seeded once
  // from whether a filter is already set. Deriving `open` from
  // hasAdvancedFilters on every render would slam the panel shut the moment
  // the last field is cleared while the user is still working in it.
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters)

  const clearAdvancedFilters = () => {
    const updated = new URLSearchParams(params)
    for (const key of ['price_min', 'price_max', 'area_min', 'area_max', 'is_featured']) {
      updated.delete(key)
    }
    updated.delete('offset')
    setParams(updated, { replace: true })
    setAdvancedResetKey((n) => n + 1)
  }

  const resource = useResource((signal) => listProperties(filters, signal), [serializedFilters])

  // useResource keeps the previous ready `data` in place while a deps-change
  // refetch is in flight — good for not blanking the table, but it means
  // nothing today tells the pager/segmented controls a fetch is running. This
  // derives that signal locally rather than changing the shared hook.
  const readyData = resource.status === 'ready' ? resource.data : undefined
  const [isRefetching, setIsRefetching] = useState(false)
  useEffect(() => {
    setIsRefetching(true)
  }, [serializedFilters])
  useEffect(() => {
    if (readyData !== undefined) setIsRefetching(false)
  }, [readyData])

  // A selection that survived a filter change refers to rows nobody can see.
  // Acting on invisible rows is exactly what the all-or-nothing 404 protects
  // against, so drop it here rather than letting the server refuse later.
  useEffect(() => {
    setSelected(new Set())
  }, [serializedFilters])

  const applyKpiFilter = (filter: PropertyFilters) => {
    // A shortcut is a jump to a view, not an additional constraint —
    // replaces the current filters rather than merging into them.
    setParams(new URLSearchParams(propertyParams(filter)), { replace: true })
    // A shortcut can silently drop a price/area filter the advanced panel had
    // set (none of the KPI cards set one themselves) — remount those fields
    // so they don't keep showing a value the URL no longer has.
    setAdvancedResetKey((n) => n + 1)
  }

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // A.7 — publishing one row reuses the same batch endpoint as the bulk bar
  // (one id, not twenty), so an approval refusal behaves identically either
  // way and the refusal words cannot drift between the two call sites.
  const publishOne = async (id: number) => {
    try {
      await runBatch('publish', [id])
      resource.reload()
      summaryResource.reload()
    } catch (failure: unknown) {
      // Inline publish has no bulk bar to host an inline error, and the row is
      // still on screen — a toast is the one exception to "no success toasts"
      // (design.md:143): this reports a change the UI implied that the server
      // then refused.
      const classified = classifyBatchError(failure)
      fail(messageFor(classified, t))
      // A 404 here means this row is gone — the same "stale selection" the
      // bulk bar's onStale resyncs for. Reload both, or the row (and a total
      // that still counts it) stays a phantom on screen. Other refusals (e.g.
      // not-approved) leave the row exactly as it was, so there's nothing to
      // resync.
      if (classified.kind === 'stale') {
        resource.reload()
        summaryResource.reload()
      }
    }
  }

  if (resource.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (resource.status === 'error') {
    return (
      <ErrorState message={resource.message} retryLabel={t('common.retry')} onRetry={resource.reload} />
    )
  }

  const { items, total } = resource.data
  const offset = filters.offset ?? 0

  const selectAllShown = () => {
    // The server refuses more than MAX_BATCH ids. Cap here so the agent gets
    // a clear message instead of a 422 they cannot act on.
    setSelected(new Set(items.slice(0, MAX_BATCH).map((property) => property.id)))
    if (items.length > MAX_BATCH) fail(t('bulk.cappedAt', { max: MAX_BATCH }))
  }

  const allShown = items.length > 0 && items.every((property) => selected.has(property.id))

  const columns: Column<CrmProperty>[] = [
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
      header: t('properties.code'),
      card: 'meta',
      render: (property) => (
        <span className="font-mono">
          {property.city !== null ? `${property.code} · ${property.city}` : property.code}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (property) => {
        // Don't stack two badges saying the same thing: a row rejected at both
        // lifecycle and moderation would otherwise show "Rechazada" twice.
        const moderationAddsNothing =
          property.lifecycle === 'rejected' && property.moderation === 'rejected'
        return (
          <div className="flex flex-wrap items-center gap-1">
            <LifecycleBadge lifecycle={property.lifecycle} />
            <OperationBadge operation={property.operation} />
            {!moderationAddsNothing && <ModerationBadge moderation={property.moderation} />}
            {property.featured_expires_at !== null && <Badge tone="warning">★</Badge>}
          </div>
        )
      },
    },
    {
      key: 'price',
      header: t('common.price'),
      numeric: true,
      render: (property) => (
        <span className="text-ink">
          {property.price === null ? '—' : formatCurrency(property.price)}
        </span>
      ),
    },
    {
      key: 'area',
      // Not common.area ("Área") — this cell renders bedrooms/bathrooms/area
      // together, and below `lg` the Register card layout uses this header
      // as the field's own <dt> (register.tsx), so a stale "Área" label sits
      // directly over "3h · 2b · 210 m²" on mobile.
      header: t('propertyDetail.specs'),
      numeric: true,
      render: (property) => (
        <span className="text-xs text-muted">{formatSpecs(property, formatNumber)}</span>
      ),
    },
    {
      key: 'leads',
      header: t('common.leads'),
      numeric: true,
      render: (property) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="text-ink-2">{property.leads_count}</span>
          {property.unanswered_leads > 0 && (
            <Badge tone="danger">{property.unanswered_leads}</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (property) => <InlineAction property={property} onPublish={publishOne} />,
    },
  ]

  const pager = (
    <Pager
      offset={offset}
      total={total}
      itemsCount={items.length}
      onOffsetChange={(next) => setParam('offset', String(next))}
    />
  )

  return (
    <>
      <PageHeader
        title={t('properties.title')}
        actions={
          // A.8 — with 3 or fewer listings the density toggle has nothing to
          // earn its keep against; it only appears once the list does.
          showChrome ? (
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
          ) : undefined
        }
      />

      {summaryResource.status === 'loading' && (
        <div className="mb-4">
          <LoadingState label={t('common.loading')} />
        </div>
      )}
      {summaryResource.status === 'error' && (
        <div className="mb-4">
          <ErrorState
            message={summaryResource.message}
            retryLabel={t('common.retry')}
            onRetry={summaryResource.reload}
          />
        </div>
      )}
      {summaryResource.status === 'ready' && (
        <KpiStrip summary={summaryResource.data} onPick={applyKpiFilter} />
      )}

      {/* A.6 — gated on the rail's own total > 0 alone (ActionRail renders
          nothing itself when empty). NOT showChrome: that gate is A.8's
          listing-density threshold, about growing the density toggle and
          advanced filters with inventory — it was never meant to hide
          pending work. An agent with 3 listings and 4 overdue tasks must
          still see this. A loading or failed rail fetch just shows nothing
          here rather than a spinner or error banner — it is a shortcut
          strip, not primary content, and the table below is unaffected
          either way. */}
      {railResource.status === 'ready' && <ActionRail rail={railResource.data} />}

      <FilterBar>
        <SearchField
          id="property-search"
          label={t('common.search')}
          value={draftSearch}
          onChange={setDraftSearch}
          placeholder={t('properties.searchPlaceholder')}
          resultLabel={t('common.resultCount', { count: total })}
          pending={draftSearch !== (filters.search ?? '') || isRefetching}
        />

        <div
          className={
            isRefetching ? 'opacity-60 transition-opacity duration-(--duration-base)' : ''
          }
        >
          <Segmented
            group="property-lifecycle"
            label={t('common.status')}
            value={filters.lifecycle ?? null}
            onChange={(next) => setParam('lifecycle', next)}
            options={[
              { value: null, label: t('common.all') },
              ...LIFECYCLES.map((option) => ({
                value: option,
                label: t(`lifecycle.${option}`),
              })),
            ]}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="property-sort" className="text-sm text-muted">
            {t('properties.sort')}
          </label>
          <select
            id="property-sort"
            value={filters.sort ?? 'newest'}
            onChange={(event) => setParam('sort', event.target.value)}
            className="min-h-9 rounded-md border border-rule-2 bg-surface-raised px-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
          >
            {PROPERTY_SORTS.map((option) => (
              <option key={option} value={option}>
                {t(`properties.sort.${option}`)}
              </option>
            ))}
          </select>
        </div>

        <label className="ml-auto hidden items-center gap-1.5 text-sm text-muted lg:flex">
          <input
            type="checkbox"
            checked={allShown}
            onChange={() => (allShown ? setSelected(new Set()) : selectAllShown())}
            className="accent-[var(--color-accent)]"
          />
          {t('common.all')}
        </label>
      </FilterBar>

      {/* A.8 — advanced filters (price/area/featured) only earn a spot once
          the density toggle does, same threshold. Search, the lifecycle chips
          and sort stay in FilterBar above regardless of size — those are
          basic, not advanced. Native <details> for the disclosure: free
          keyboard support and no state to wire up. */}
      {showChrome && (
        <details
          className="mb-3"
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-ink-2 hover:text-ink">
            {t('properties.filtersAdvanced')}
          </summary>
          {/* Keyed on advancedResetKey, NOT the filter set: it only bumps on
              an external reset (this panel's own "Limpiar filtros", or a KPI
              shortcut), never on a field's own onBlur commit — remounting on
              every commit destroyed the input mid-Tab and ate clicks on
              "Limpiar filtros" (its mousedown blurs the focused field first). */}
          <div
            key={advancedResetKey}
            className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-rule bg-surface-raised p-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="property-price-min" className="text-xs text-muted">
                {t('properties.priceFrom')}
              </label>
              <input
                id="property-price-min"
                type="number"
                defaultValue={filters.price_min ?? ''}
                onBlur={(event) =>
                  setParam('price_min', event.target.value === '' ? null : event.target.value)
                }
                className="min-h-9 w-28 rounded-md border border-rule-2 bg-surface-raised px-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="property-price-max" className="text-xs text-muted">
                {t('properties.priceTo')}
              </label>
              <input
                id="property-price-max"
                type="number"
                defaultValue={filters.price_max ?? ''}
                onBlur={(event) =>
                  setParam('price_max', event.target.value === '' ? null : event.target.value)
                }
                className="min-h-9 w-28 rounded-md border border-rule-2 bg-surface-raised px-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="property-area-min" className="text-xs text-muted">
                {t('properties.areaFrom')}
              </label>
              <input
                id="property-area-min"
                type="number"
                defaultValue={filters.area_min ?? ''}
                onBlur={(event) =>
                  setParam('area_min', event.target.value === '' ? null : event.target.value)
                }
                className="min-h-9 w-24 rounded-md border border-rule-2 bg-surface-raised px-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="property-area-max" className="text-xs text-muted">
                {t('properties.areaTo')}
              </label>
              <input
                id="property-area-max"
                type="number"
                defaultValue={filters.area_max ?? ''}
                onBlur={(event) =>
                  setParam('area_max', event.target.value === '' ? null : event.target.value)
                }
                className="min-h-9 w-24 rounded-md border border-rule-2 bg-surface-raised px-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
              />
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={filters.is_featured === true}
                onChange={(event) =>
                  setParam('is_featured', event.target.checked ? 'true' : null)
                }
                className="accent-[var(--color-accent)]"
              />
              {t('properties.featuredOnly')}
            </label>
            <Button onClick={clearAdvancedFilters}>{t('properties.clearFilters')}</Button>
          </div>
        </details>
      )}

      {/* A.4 — the bulk bar only exists while something is selected, and it
          slides rather than appears, so the table shifting down is explained.
          BulkBar owns its own visual chrome — the wrapper is animation-only.
          Gated on selection alone, not on the summary being ready: only
          `feature` needs the balance, so a failed/slow summary fetch must not
          take the other four actions down with it (BulkBar disables just
          `feature` when balance is null). */}
      <AnimatePresence initial={false}>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <BulkBar
              ids={[...selected]}
              balance={summaryResource.status === 'ready' ? summaryResource.data.featured_balance : null}
              onDone={() => {
                // Rows, KPIs, the cleared selection and the bar closing are
                // already four visible signals the batch landed — a success
                // toast would be a fifth saying nothing new (design.md:143,
                // "no success toasts"). Failures stay inline in the bar: a
                // shortfall is a number the agent has to read and act on.
                setSelected(new Set())
                resource.reload()
                summaryResource.reload()
                // A batch can change any of the four rail buckets (delete a
                // rejected row, feature one into its expiring window, ...) —
                // phase 2a shipped exactly this gap with the summary.
                railResource.reload()
              }}
              onStale={() => {
                setSelected(new Set())
                resource.reload()
                // A 404 means a row disappeared — the total is wrong too, and
                // showChrome (the A.8 gate) reads it.
                summaryResource.reload()
                railResource.reload()
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 ? (
        <>
          <EmptyState title={t('properties.empty')} hint={t('properties.emptyHint')} />
          {/* A filter can legitimately have zero matches (offset 0 — nothing to
              go back to), but a nonzero offset past the end of the result set
              (the page shrank under you, or a stale ?offset=N bookmark) is a
              dead end without this: no Previous button anywhere on screen. */}
          {offset > 0 && <div className="mt-3">{pager}</div>}
        </>
      ) : (
        <div className={isRefetching ? 'opacity-60 transition-opacity duration-(--duration-base)' : ''}>
          <Register
            label={t('properties.title')}
            columns={columns}
            rows={items}
            rowKey={(property) => property.id}
            density={compact ? 'compact' : 'comfortable'}
            footer={
              <tr>
                <td colSpan={columns.length} className="px-3 py-2">
                  {pager}
                </td>
              </tr>
            }
          />
          {/* The card layout below `lg` has no `<tfoot>` — without this, mobile
              sees page 1 and nothing else. */}
          <div className="mt-3 lg:hidden">{pager}</div>
        </div>
      )}
    </>
  )
}
