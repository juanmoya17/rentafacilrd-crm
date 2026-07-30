import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlignJustify,
  ArrowUpDown,
  LayoutGrid,
  // Aliased: an unqualified `Map` import shadows the global constructor, and
  // the map view's own `new Map<number, HTMLLIElement>()` stops compiling.
  Map as MapIcon,
  MessageSquareDot,
  PencilLine,
  FilterX,
  Rows3,
  SlidersHorizontal,
  Star,
  StretchVertical,
  Upload,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { FilterBar, Register, SearchField, Segmented, type Column } from '@/components/register'
import { LifecycleBadge, ModerationBadge, OperationBadge } from '@/components/labels'
import { PhotoDots, PropertyPhoto } from '@/components/property-photo'
import { PropertyMap } from '@/components/property-map'
import { KpiStrip } from '@/components/kpi-strip'
import { BulkBar } from '@/components/bulk-bar'
import { ActionRail } from '@/components/action-rail'
import { useRecordMorph, useRowReveal } from '@/lib/motion'
import { useResource } from '@/lib/use-resource'
import { useToast } from '@/lib/toast-context'
import {
  classifyBatchError,
  formatSpecs,
  getActionRail,
  getPropertySummary,
  isLocated,
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

  // Each branch gets its own glyph, so the action a row is offering is legible
  // from the shape before the label is read — which is the point of icons in a
  // list where every row's button says something different.
  if (property.lifecycle === 'rejected') {
    return (
      <Button>
        <PencilLine className="size-4" aria-hidden="true" />
        {t('properties.inlineFix')}
      </Button>
    )
  }
  if (property.lifecycle === 'paused') {
    return (
      <Button onClick={() => onPublish(property.id)}>
        <Upload className="size-4" aria-hidden="true" />
        {t('properties.inlinePublish')}
      </Button>
    )
  }
  if (property.unanswered_leads > 0) {
    // LeadFilters already accepts property_id, so this lands on the filtered
    // lead list the button's label promises — not the listing's own detail
    // page (that link is PropertyName's job, on the title column).
    return (
      <Link to={`/leads?property_id=${property.id}`} viewTransition>
        <Button>
          <MessageSquareDot className="size-4" aria-hidden="true" />
          {t('properties.inlineLeads', { count: property.unanswered_leads })}
        </Button>
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
      return (
        <Button variant="primary">
          <Star className="size-4" aria-hidden="true" />
          {t('properties.inlineRenew', { days })}
        </Button>
      )
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

/* The three cells below are shared by the table columns and the card grid.
   They exist as components rather than inline JSX for one reason: a second
   copy of the "don't stack two badges saying the same thing" rule, or of the
   unanswered-leads threshold, would drift the moment either changes. Same
   discipline as Register driving both its layouts off one column list. */

function StatusBadges({ property }: { property: CrmProperty }) {
  // A row rejected at both lifecycle and moderation would otherwise show
  // "Rechazada" twice.
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
}

function LeadCount({ property }: { property: CrmProperty }) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span className="text-ink-2">{property.leads_count}</span>
      {property.unanswered_leads > 0 && <Badge tone="danger">{property.unanswered_leads}</Badge>}
    </span>
  )
}

function PriceCell({ property }: { property: CrmProperty }) {
  const { formatCurrency } = useI18n()
  return <>{property.price === null ? '—' : formatCurrency(property.price)}</>
}

/**
 * Card grid — the second view of the same rows.
 *
 * Deliberately not a third layout inside `Register`: Register projects an
 * abstract column list, and this card is property-shaped (a price line, a spec
 * line, a badge row, one contextual action). Generalising Register for one
 * caller would have meant a knob per slot. The anti-drift guarantee comes from
 * the cells instead — every value here renders through the same component the
 * table column does.
 *
 * Unlike Register's sub-`lg` card stack, this one carries a real checkbox.
 * There the checkbox column is hidden because tapping selects; here the whole
 * card is a link to the record, so selection needs its own target — and it is
 * the only way to reach the bulk bar below `lg`.
 */
function PropertyCardGrid({
  items,
  selected,
  onToggle,
  onPublish,
}: {
  items: CrmProperty[]
  selected: Set<number>
  onToggle: (id: number) => void
  onPublish: (id: number) => void
}) {
  const { t, formatNumber } = useI18n()
  const reveal = useRowReveal()

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((property, index) => (
        <motion.li
          key={property.id}
          {...reveal(index)}
          /* relative: `.rf-cardlink` stretches the title's anchor across this
             element, so anything else clickable inside it needs to paint
             above that overlay — hence `relative` on the checkbox and on the
             footer row, not here alone. */
          className="relative flex flex-col rounded-lg border border-rule bg-surface-raised p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2"
        >
          {/* The photo carries the checkbox rather than the title row: over an
              image it is always on the same surface, and it keeps the identity
              line's left edge flush with everything below it. */}
          <figure
            className="relative mb-3"
            aria-label={
              property.images.length === 0
                ? t('properties.noPhotos')
                : t('properties.photoCount', { count: property.images.length })
            }
          >
            <PropertyPhoto
              src={property.images[0]}
              alt=""
              eager={index < 6}
              className="aspect-[16/9] w-full"
            />
            <PhotoDots count={property.images.length} />
            <input
              type="checkbox"
              checked={selected.has(property.id)}
              onChange={() => onToggle(property.id)}
              aria-label={property.title}
              /* size-4 + the tinted plate: a bare checkbox on photography is
                 invisible against a light sky and lost against a dark roof. */
              className="absolute left-1.5 top-1.5 size-4 rounded-sm bg-surface-raised accent-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-surface-raised)]"
            />
          </figure>

          <div className="min-w-0">
            <div className="rf-cardlink text-sm [overflow-wrap:anywhere]">
              <PropertyName property={property} />
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted">
              {property.city !== null ? `${property.code} · ${property.city}` : property.code}
            </p>
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm font-medium text-ink">
              <PriceCell property={property} />
            </span>
            <span className="font-mono text-xs text-muted">
              {formatSpecs(property, formatNumber)}
            </span>
          </div>

          <div className="mt-2.5">
            <StatusBadges property={property} />
          </div>

          {/* mt-auto so a card whose neighbour wrapped to two title lines still
              lines its action row up with theirs. */}
          <div className="relative mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="text-xs text-muted">
              {t('common.leads')} <LeadCount property={property} />
            </span>
            <InlineAction property={property} onPublish={onPublish} />
          </div>
        </motion.li>
      ))}
    </ul>
  )
}

/**
 * Map view — a list column synced to a pin field.
 *
 * The two panes select each other: clicking a pin scrolls its card into view
 * and marks it, clicking a card moves the pin's z-order and colour. That is
 * the whole reason both panes exist; a map beside an unrelated list is two
 * widgets, not a view.
 *
 * Listings with no coordinates cannot be drawn but must not vanish — an agent
 * who filtered to eight rows and sees six pins needs to be told where the
 * other two went, so they stay in the column below a labelled divider.
 */
function PropertyMapView({
  items,
  onPublish,
}: {
  items: CrmProperty[]
  onPublish: (id: number) => void
}) {
  const { t, formatNumber } = useI18n()
  const [activeId, setActiveId] = useState<number | null>(null)
  const cardRefs = useRef(new Map<number, HTMLLIElement>())

  const located = items.filter(isLocated)
  const unlocated = items.filter((property) => !isLocated(property))

  const select = (id: number) => {
    setActiveId(id)
    // `nearest` rather than `center`: the column is short, and yanking a card
    // the agent can already see into the middle of the pane loses their place
    // for no gain.
    cardRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  if (located.length === 0) {
    return <EmptyState title={t('properties.mapEmpty')} hint={t('properties.emptyHint')} />
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* DOM order puts the list first so keyboard and screen-reader users
          reach the listings without traversing the map's controls. */}
      <ul className="order-2 space-y-2 lg:order-1 lg:max-h-[calc(100vh-16rem)] lg:min-h-[32rem] lg:overflow-y-auto lg:pr-1">
        {located.map((property) => (
          <li
            key={property.id}
            ref={(node) => {
              if (node === null) cardRefs.current.delete(property.id)
              else cardRefs.current.set(property.id, node)
            }}
            onClick={() => setActiveId(property.id)}
            className={`relative flex gap-3 rounded-lg border bg-surface-raised p-2.5 transition-colors duration-(--duration-base) ease-out ${
              activeId === property.id
                ? 'border-accent [box-shadow:inset_2px_0_0_0_var(--color-accent)]'
                : 'border-rule hover:border-rule-2'
            }`}
          >
            <PropertyPhoto
              src={property.images[0]}
              alt=""
              className="size-20 shrink-0 sm:size-24"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="rf-cardlink text-sm [overflow-wrap:anywhere]">
                <PropertyName property={property} />
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted">{property.code}</p>
              <p className="mt-1 font-mono text-sm font-medium text-ink">
                <PriceCell property={property} />
              </p>
              <p className="font-mono text-xs text-muted">
                {formatSpecs(property, formatNumber)}
              </p>
              <div className="relative mt-auto flex justify-end pt-1.5">
                <InlineAction property={property} onPublish={onPublish} />
              </div>
            </div>
          </li>
        ))}

        {unlocated.length > 0 && (
          <li className="pt-2">
            <p className="border-t border-rule pt-2 text-xs text-muted">
              {t('properties.mapUnlocated', { count: unlocated.length })}
            </p>
            <ul className="mt-2 space-y-1">
              {unlocated.map((property) => (
                <li
                  key={property.id}
                  className="rf-cardlink relative rounded-md border border-dashed border-rule px-2.5 py-2 text-sm"
                >
                  <PropertyName property={property} />
                  <span className="ml-2 font-mono text-xs text-muted">{property.code}</span>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>

      <div className="order-1 lg:order-2">
        <PropertyMap properties={located} activeId={activeId} onSelect={select} />
      </div>
    </div>
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
  const { t, formatNumber } = useI18n()
  const { fail } = useToast()
  const [params, setParams] = useSearchParams()
  const [compact, setCompact] = useState(true)
  // Local, not in the URL, for the same reason `compact` is: this is a display
  // preference, not a filter, and the URL is reserved for the filter set that
  // has to survive a share or a bookmark.
  const [view, setView] = useState<'table' | 'cards' | 'map'>('table')
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

  // Counted, not just tested: the closed disclosure shows the number, so an
  // agent can tell "one stale price floor" from "four filters I set on
  // purpose" without opening it.
  const advancedFilterCount = [
    filters.price_min,
    filters.price_max,
    filters.area_min,
    filters.area_max,
    filters.is_featured,
  ].filter((value) => value !== undefined).length
  const hasAdvancedFilters = advancedFilterCount > 0

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
      // nowrap on both this and the specs cell: an auto-layout table hands
      // width to whichever column asks loudest, and these two were folding
      // "RF1024 · Santo Domingo" and "2h · 2b · 120 m²" onto two lines while
      // PRICE sat with slack. Refusing to wrap makes them bid for their real
      // width, and the title column — which can wrap harmlessly — absorbs it.
      render: (property) => (
        <span className="whitespace-nowrap font-mono">
          {property.city !== null ? `${property.code} · ${property.city}` : property.code}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (property) => <StatusBadges property={property} />,
    },
    {
      key: 'price',
      header: t('common.price'),
      numeric: true,
      render: (property) => (
        <span className="text-ink">
          <PriceCell property={property} />
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
        <span className="whitespace-nowrap text-xs text-muted">
          {formatSpecs(property, formatNumber)}
        </span>
      ),
    },
    {
      key: 'leads',
      header: t('common.leads'),
      numeric: true,
      render: (property) => <LeadCount property={property} />,
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

  /* A.8 — advanced filters (price/area/featured) only earn a spot once the
     density toggle does, same threshold. Search, the lifecycle chips and sort
     stay in the toolbar regardless of size — those are basic, not advanced.
     Native <details> for the disclosure: free keyboard support and no state
     to wire up.

     It rides in the toolbar's `filters` row rather than on a row of its own:
     three stacked toolbar rows pushed the table a third of the way down the
     screen. Closed, the trigger is a chip beside the status chips; open, the
     panel is wider than the remaining track so flex-wrap gives it its own
     line — which is the moment it has earned one. */
  const advancedFilters = showChrome && (
    <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
      {/* An affordance, not a bare text line: this used to be an unstyled
          <summary> that read as a paragraph and gave no hint it opened. The
          count tells the agent a filter is active while the panel is shut —
          otherwise a price floor set yesterday silently explains a short
          result list today. */}
      <summary className="inline-flex min-h-9 cursor-pointer select-none list-none items-center gap-1.5 rounded-md border border-rule-2 px-2.5 py-1 text-sm font-medium text-ink-2 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-muted" aria-hidden="true" />
        {t('properties.filtersAdvanced')}
        {advancedFilterCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 font-mono text-xs font-semibold text-accent-ink">
            {advancedFilterCount}
          </span>
        )}
      </summary>
      {/* Keyed on advancedResetKey, NOT the filter set: it only bumps on an
          external reset (this panel's own "Limpiar filtros", or a KPI
          shortcut), never on a field's own onBlur commit — remounting on every
          commit destroyed the input mid-Tab and ate clicks on "Limpiar
          filtros" (its mousedown blurs the focused field first). */}
      <div
        key={advancedResetKey}
        className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-surface-raised p-3"
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
            onChange={(event) => setParam('is_featured', event.target.checked ? 'true' : null)}
            className="accent-[var(--color-accent)]"
          />
          {t('properties.featuredOnly')}
        </label>
        <Button onClick={clearAdvancedFilters}>
          <FilterX className="size-4" aria-hidden="true" />
          {t('properties.clearFilters')}
        </Button>
      </div>
    </details>
  )

  return (
    <>
      {/* The view and density controls used to live here. They sit in the
          toolbar's right cluster now, next to sort — the header states what
          the page is, the toolbar holds everything that changes what it
          shows. */}
      <PageHeader title={t('properties.title')} />

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

      <FilterBar
        actions={
          <>
            {/* The sort label is now the icon: "Orden" beside a select whose
                options all read as orderings was naming the obvious. The
                arrows carry it, and the select keeps its own <label> for
                screen readers. */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="property-sort" className="sr-only">
                {t('properties.sort')}
              </label>
              <div className="relative flex items-center">
                <ArrowUpDown
                  className="pointer-events-none absolute left-2.5 size-4 text-muted"
                  aria-hidden="true"
                />
                <select
                  id="property-sort"
                  value={filters.sort ?? 'newest'}
                  onChange={(event) => setParam('sort', event.target.value)}
                  className="min-h-9 rounded-md border border-rule-2 bg-surface-raised py-1.5 pl-8 pr-2 text-sm text-ink transition-colors duration-(--duration-base) ease-out hover:bg-surface-sunken"
                >
                  {PROPERTY_SORTS.map((option) => (
                    <option key={option} value={option}>
                      {t(`properties.sort.${option}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* A.8 — same threshold as the density toggle: with three listings
                there is nothing to switch between. Icon-only: three view modes
                whose names ("Tabla / Fichas / Mapa") each duplicate what their
                glyph already says, in a control the agent uses constantly. */}
            {showChrome && (
              <Segmented
                group="property-view"
                label={t('properties.view')}
                value={view}
                onChange={(next) => setView(next ?? 'table')}
                options={[
                  { value: 'table', label: t('properties.viewTable'), icon: Rows3 },
                  { value: 'cards', label: t('properties.viewCards'), icon: LayoutGrid },
                  { value: 'map', label: t('properties.viewMap'), icon: MapIcon },
                ]}
                iconOnly
              />
            )}

            {/* Density is a row-height control on the table only — in the card
                grid it has nothing to act on, so it goes rather than sitting
                there inert. */}
            {showChrome && view === 'table' && (
              <Segmented
                group="property-density"
                label={t('properties.density')}
                value={compact ? 'compact' : 'comfortable'}
                onChange={(next) => setCompact(next !== 'comfortable')}
                options={[
                  { value: 'compact', label: t('properties.densityCompact'), icon: AlignJustify },
                  {
                    value: 'comfortable',
                    label: t('properties.densityComfortable'),
                    icon: StretchVertical,
                  },
                ]}
                iconOnly
              />
            )}

            {/* Hidden below `lg` in table view because Register's card stack has
                no checkboxes to select — but the card grid does, at every width,
                so there it stays. The map view has no selection at all, so
                nothing to select-all. */}
            <label
              className={`items-center gap-1.5 text-sm text-muted ${
                view === 'map' ? 'hidden' : view === 'cards' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <input
                type="checkbox"
                checked={allShown}
                onChange={() => (allShown ? setSelected(new Set()) : selectAllShown())}
                className="accent-[var(--color-accent)]"
              />
              {t('common.all')}
            </label>
          </>
        }
        filters={
          <>
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
            {advancedFilters}
          </>
        }
      >
        <SearchField
          id="property-search"
          label={t('common.search')}
          value={draftSearch}
          onChange={setDraftSearch}
          placeholder={t('properties.searchPlaceholder')}
          resultLabel={t('common.resultCount', { count: total })}
          pending={draftSearch !== (filters.search ?? '') || isRefetching}
        />
      </FilterBar>


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
          {/* Exactly one of the two renders. That is load-bearing, not a
              formality: Register already keeps two layouts in the DOM at once
              and relies on `display: none` to stop the hidden copy claiming
              `view-transition-name: record-title`. A card grid mounted
              alongside it would be a *visible* third copy of every title, two
              elements would claim the name, and the record morph would stop
              working with no error (design.md § Layout invariants). */}
          {view === 'map' ? (
            <>
              <PropertyMapView items={items} onPublish={publishOne} />
              <div className="mt-3">{pager}</div>
            </>
          ) : view === 'cards' ? (
            <>
              <PropertyCardGrid
                items={items}
                selected={selected}
                onToggle={toggle}
                onPublish={publishOne}
              />
              <div className="mt-3">{pager}</div>
            </>
          ) : (
            <>
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
              {/* The card layout below `lg` has no `<tfoot>` — without this,
                  mobile sees page 1 and nothing else. */}
              <div className="mt-3 lg:hidden">{pager}</div>
            </>
          )}
        </div>
      )}
    </>
  )
}
