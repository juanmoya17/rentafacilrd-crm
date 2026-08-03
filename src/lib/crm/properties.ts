import { ApiError, api } from '@/lib/api'
import type { Translate } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'
import type { Page } from './api'
import type {
  ActionRail,
  BulkAction,
  CrmProperty,
  Lifecycle,
  Moderation,
  Operation,
  PropertySummary,
  RailBucketKey,
  Shortfall,
} from './types'

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

export type PropertySort = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'most_viewed'

export const PROPERTY_SORTS: PropertySort[] = [
  'newest', 'oldest', 'price_asc', 'price_desc', 'most_viewed',
]

export interface PropertyFilters {
  search?: string
  lifecycle?: Lifecycle
  operation?: Operation
  moderation?: Moderation
  is_featured?: boolean
  /** The KPI/dashboard shortcut: active advertisement expiring within the
   *  server's window (PropertyListQuery::applyFeaturedExpiringWindow), NOT
   *  "featured" in general — is_featured stays the advanced-filter checkbox. */
  featured_expiring?: boolean
  city_id?: number
  price_min?: number
  price_max?: number
  area_min?: number
  area_max?: number
  sort?: PropertySort
  offset?: number
  limit?: number
}

/**
 * Filters -> query params. Exported and pure because it is the one part of the
 * request path a test can reach in this repo.
 *
 * `false` and `0` must survive: `is_featured=false` is a real filter for "not
 * featured", and `price_min=0` is a real floor. Only undefined and the empty
 * string are dropped.
 */
export function propertyParams(filters: PropertyFilters): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue
    params[key] = String(value)
  }
  return params
}

/**
 * `3h · 2b · 210 m²` — drops any null part and its adjacent separator rather
 * than rendering a zero. A missing bedroom/bathroom count means unknown, not
 * "none", same discipline `LifecycleBadge` uses for a null lifecycle. All
 * three null renders the register's own em dash.
 *
 * `formatNumber` is injected rather than imported so this stays pure and
 * testable without an i18n provider — same pattern `messageFor` uses for `t`.
 */
/** A listing the map can actually draw — both coordinates present. */
export interface LocatedProperty extends CrmProperty {
  lat: number
  lng: number
}

/**
 * Narrows to the drawable rows.
 *
 * Both-or-neither is the wire contract (types.ts), but the guard checks both
 * anyway: a half-geocoded row from a partial backfill would otherwise reach
 * Leaflet as `[18.4, null]` and throw inside the map rather than being
 * counted as unlocated in the column beside it.
 */
export function isLocated(property: CrmProperty): property is LocatedProperty {
  return property.lat !== null && property.lng !== null
}

export function formatSpecs(
  property: Pick<CrmProperty, 'bedrooms' | 'bathrooms' | 'area'>,
  formatNumber: (value: number) => string,
): string {
  const parts: string[] = []
  if (property.bedrooms !== null) parts.push(`${formatNumber(property.bedrooms)}h`)
  if (property.bathrooms !== null) parts.push(`${formatNumber(property.bathrooms)}b`)
  if (property.area !== null) parts.push(`${formatNumber(property.area)} m²`)
  return parts.length === 0 ? '—' : parts.join(' · ')
}

/**
 * A.6 rail bucket -> route+query. Pure and exported so a unit test can walk
 * every key. The exhaustive switch has no `default`: adding a RailBucketKey
 * without adding a case here is a compile error (a function whose control
 * flow can fall through without returning), not a silently dead link — the
 * exact bug class that shipped twice already on this branch.
 */
/**
 * A.6 bucket -> label. A plain data map (not a component), so it lives here
 * rather than in action-rail.tsx: exporting a non-component constant from a
 * component file trips the react-refresh only-export-components lint rule,
 * and dashboard.tsx needs the same mapping action-rail.tsx uses so the two
 * screens' rails cannot drift out of sync.
 */
export const BUCKET_LABEL: Record<RailBucketKey, TranslationKey> = {
  rejected: 'dashboard.rejected',
  expiring_featured: 'dashboard.featuredExpiring',
  sla_breached: 'dashboard.slaBreached',
  overdue_tasks: 'rail.overdueTasks',
}

export function railBucketTarget(key: RailBucketKey): string {
  switch (key) {
    case 'rejected':
      return '/properties?lifecycle=rejected'
    case 'expiring_featured':
      return '/properties?featured_expiring=true'
    case 'sla_breached':
      return '/leads?sla=breached'
    case 'overdue_tasks':
      return '/tasks?status=overdue'
  }
}

export type BatchFailure =
  | { kind: 'shortfall'; shortfall: Shortfall }
  | { kind: 'notApproved'; ids: number[] }
  | { kind: 'alreadyFeatured'; ids: number[] }
  | { kind: 'stale' }
  | { kind: 'other'; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function idList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.filter((entry): entry is number => typeof entry === 'number')
  return ids.length === value.length ? ids : null
}

function shortfallOf(value: unknown): Shortfall | null {
  if (!isRecord(value)) return null
  const { need, have, short } = value
  if (typeof need !== 'number' || typeof have !== 'number' || typeof short !== 'number') {
    return null
  }
  return { need, have, short }
}

/**
 * The batch endpoint refuses in four distinct ways and each one needs different
 * words on screen. Narrowing here keeps that knowledge out of the component.
 */
export function classifyBatchError(error: unknown): BatchFailure {
  if (!(error instanceof ApiError)) {
    return { kind: 'other', message: error instanceof Error ? error.message : 'Error' }
  }

  const data = isRecord(error.payload) ? error.payload.data : null
  const message = isRecord(error.payload) && typeof error.payload.message === 'string'
    ? error.payload.message
    : error.message

  if (error.status === 404) return { kind: 'stale' }

  if (error.status === 409 && isRecord(data)) {
    const notApproved = idList(data.not_approved)
    if (notApproved !== null) return { kind: 'notApproved', ids: notApproved }

    const alreadyFeatured = idList(data.already_featured)
    if (alreadyFeatured !== null) return { kind: 'alreadyFeatured', ids: alreadyFeatured }

    const shortfall = shortfallOf(data)
    if (shortfall !== null) return { kind: 'shortfall', shortfall }
  }

  return { kind: 'other', message }
}

/**
 * Words for each of the four refusals, plus the non-refusal fallback. Shared
 * by the bulk bar (Task 6) and the inline publish action (Task 7) so the
 * mapping cannot drift between the two call sites.
 *
 * Every branch but `stale` appends `bulk.nothingChanged` — the batch endpoint
 * is all-or-nothing, and the one thing every refusal (including an
 * unclassified `other`, e.g. a 422) has in common is that nothing was
 * applied. `stale` omits it: the list is refreshing anyway.
 */
export function messageFor(failure: BatchFailure, t: Translate): string {
  switch (failure.kind) {
    case 'shortfall':
      return `${t('bulk.shortfall', { ...failure.shortfall })} ${t('bulk.nothingChanged')}`
    case 'notApproved':
      return `${t('bulk.notApproved', { count: failure.ids.length })} ${t('bulk.nothingChanged')}`
    case 'alreadyFeatured':
      return `${t('bulk.alreadyFeatured', { count: failure.ids.length })} ${t('bulk.nothingChanged')}`
    case 'stale':
      return t('bulk.stale')
    case 'other':
      return `${failure.message} ${t('bulk.nothingChanged')}`
  }
}

function query(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  return search === '' ? '' : `?${search}`
}

/**
 * What the endpoint actually sends today: the legacy listing row, with
 * `title_image` in place of `images` and the coordinates as strings under
 * their old names. Everything else already matches CrmProperty.
 */
interface WireProperty extends Omit<CrmProperty, 'images' | 'lat' | 'lng'> {
  images?: string[] | null
  lat?: number | null
  lng?: number | null
  title_image?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

/** `''` is the API's "not geocoded", and `Number('')` is 0 — a legal
 *  coordinate in the Atlantic. Reject it before parsing, not after. */
function coord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The one place every screen's rows come through, so the `images: []`-always
 * contract in types.ts is made true here rather than guarded at each of the
 * consumers that trust it. Same for the coordinates: `isLocated` checks for
 * null, and an absent `lat` would sail past that check straight into Leaflet.
 */
export function normalizeProperty(row: WireProperty): CrmProperty {
  const lat = coord(row.lat ?? row.latitude)
  const lng = coord(row.lng ?? row.longitude)
  return {
    ...row,
    images: row.images ?? (row.title_image ? [row.title_image] : []),
    // Both or neither — a half-geocoded row counts as unlocated, not drawable.
    lat: lng === null ? null : lat,
    lng: lat === null ? null : lng,
  }
}

export async function listProperties(
  filters: PropertyFilters = {},
  signal?: AbortSignal,
): Promise<Page<CrmProperty>> {
  const response = await api<Envelope<WireProperty[]>>(
    `crm/properties${query(propertyParams(filters))}`,
    { signal },
  )
  const items = response.data.map(normalizeProperty)
  return { items, total: response.total ?? items.length }
}

export async function getPropertySummary(signal?: AbortSignal): Promise<PropertySummary> {
  const response = await api<Envelope<PropertySummary>>('crm/properties/summary', { signal })
  return response.data
}

export async function getActionRail(signal?: AbortSignal): Promise<ActionRail> {
  const response = await api<Envelope<ActionRail>>('crm/action-rail', { signal })
  return response.data
}

/** Resolves to the affected count. Throws ApiError; call classifyBatchError on it. */
export async function runBatch(action: BulkAction, ids: number[]): Promise<number> {
  const response = await api<Envelope<{ action: BulkAction; affected: number }>>(
    'crm/properties/batch',
    { method: 'POST', body: { action, ids } },
  )
  return response.data.affected
}
