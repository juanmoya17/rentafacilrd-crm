import { ApiError, api } from '@/lib/api'
import type { Translate } from '@/lib/i18n/context'
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

export async function listProperties(
  filters: PropertyFilters = {},
  signal?: AbortSignal,
): Promise<Page<CrmProperty>> {
  const response = await api<Envelope<CrmProperty[]>>(
    `crm/properties${query(propertyParams(filters))}`,
    { signal },
  )
  return { items: response.data, total: response.total ?? response.data.length }
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
