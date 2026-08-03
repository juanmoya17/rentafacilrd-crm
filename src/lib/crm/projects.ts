import { api } from '@/lib/api'

/**
 * Wire shapes for /api/crm/projects — mirrors ProjectResource,
 * ProjectTypologyResource and ProjectUnitResource. Keys stay snake_case
 * exactly as the API sends them, so a mismatch is a compile error rather
 * than a silent undefined.
 */

export type UnitStatus = 'available' | 'reserved' | 'sold' | 'unavailable'

/** Canonical order — mirrors ProjectUnit::STATUSES. The inventory columns
 *  come from this, not from the data, so a status nothing is in keeps its
 *  column instead of disappearing. */
export const UNIT_STATUSES: UnitStatus[] = ['available', 'reserved', 'sold', 'unavailable']

/**
 * The agent-controlled stage. NOT the discriminator and NOT a lifecycle:
 * `status` on a project is a boolean publish flag, and `sold_out` is derived
 * from inventory. The mock data this screen used to run on invented a
 * four-value status (preselling/building/delivered/sold_out) that exists
 * nowhere in the domain — `delivered` in particular was deliberately deferred
 * until a Flutter release can write it.
 */
export type ProjectStage = 'upcoming' | 'under_process'

export interface CrmProject {
  id: number
  listing_type: 'project'
  title: string
  slug_id: string | null
  image: string | null
  city: string | null
  type: ProjectStage
  status: number
  request_status: string | null
  /** Null, never 0: no pricing information means no range to render. */
  price_from: string | null
  price_to: string | null
  units_total: number
  units_available: number
  sold_out: boolean
}

export interface CrmTypology {
  id: number
  project_id: number
  title: string
  document: string | null
  /** Every one of these is nullable. A typology with no area has missing
   *  data, not an area of zero. */
  bedrooms: number | null
  bathrooms: number | null
  area: string | null
  base_price: string | null
  amenities: string[] | null
  condition_tags: string[] | null
  sort_order: number
  units_total?: number
  units_available?: number
}

export interface CrmUnit {
  id: number
  project_id: number
  typology_id: number | null
  identifier: string
  /** A string on purpose: "PB", "Mezzanine" and "PH" are real floors here. */
  floor: string | null
  price: string | null
  status: UnitStatus
  sold_by: number | null
  sold_at: string | null
}

export interface InventoryProjectRow {
  id: number
  title: string
  slug_id: string | null
  city: string | null
  units_total: number
  units_available: number
  by_status: Record<UnitStatus, number>
  sold_out: boolean
  price_from: string | null
  price_to: string | null
}

export interface Inventory {
  totals: Record<UnitStatus, number> & { units_total: number }
  projects: InventoryProjectRow[]
}

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

export type InventoryState = 'empty' | 'sold_out' | 'available'

/**
 * The three states a project's inventory can be in, kept as one function
 * because the distinction is easy to lose in JSX.
 *
 * `empty` is NOT `sold_out`: zero units means inventory that has not been
 * loaded yet, and an availability bar at 0% renders identically to a
 * sold-out one. The server draws the same line (Projects::getSoldOutAttribute
 * requires at least one unit), and this is the screen-side half of it.
 */
export function inventoryState(project: {
  units_total: number
  sold_out: boolean
}): InventoryState {
  if (project.units_total === 0) return 'empty'

  return project.sold_out ? 'sold_out' : 'available'
}

export async function fetchProjects(signal?: AbortSignal): Promise<CrmProject[]> {
  const body = await api<Envelope<CrmProject[]>>('crm/projects', { signal })

  return body.data ?? []
}

export async function fetchInventory(signal?: AbortSignal): Promise<Inventory> {
  const body = await api<Envelope<Inventory>>('crm/projects/inventory', { signal })

  return body.data
}

export async function fetchTypologies(
  projectId: number,
  signal?: AbortSignal,
): Promise<CrmTypology[]> {
  // Already ordered sort_order then id by the server — do not re-sort here,
  // or the agent's ordering silently stops being the one on screen.
  const body = await api<Envelope<CrmTypology[]>>(`crm/projects/${projectId}/typologies`, { signal })

  return body.data ?? []
}

export async function fetchUnits(
  projectId: number,
  filters: { status?: UnitStatus } = {},
  signal?: AbortSignal,
): Promise<CrmUnit[]> {
  const query = filters.status ? `?status=${filters.status}` : ''
  const body = await api<Envelope<CrmUnit[]>>(`crm/projects/${projectId}/units${query}`, { signal })

  return body.data ?? []
}

export interface TypologyInput {
  title: string
  bedrooms?: number | null
  bathrooms?: number | null
  area?: number | null
  base_price?: number | null
  amenities?: string[]
  condition_tags?: string[]
  sort_order?: number
}

export async function createTypology(
  projectId: number,
  input: TypologyInput,
): Promise<CrmTypology> {
  const body = await api<Envelope<CrmTypology>>(`crm/projects/${projectId}/typologies`, {
    method: 'POST',
    body: input,
  })

  return body.data
}

export async function updateTypology(
  projectId: number,
  typologyId: number,
  input: Partial<TypologyInput>,
): Promise<CrmTypology> {
  const body = await api<Envelope<CrmTypology>>(
    `crm/projects/${projectId}/typologies/${typologyId}`,
    { method: 'PATCH', body: input },
  )

  return body.data
}

/**
 * Deleting a typology keeps its units and only strips their classification —
 * the server reports how many, and the screen must show it. An agent removing
 * "Tipo B" with twelve units under it deserves to know those twelve survive.
 */
export async function deleteTypology(
  projectId: number,
  typologyId: number,
): Promise<{ units_declassified: number }> {
  const body = await api<Envelope<{ units_declassified: number }>>(
    `crm/projects/${projectId}/typologies/${typologyId}`,
    { method: 'DELETE' },
  )

  return body.data
}

export interface UnitBatchInput {
  from: string
  to: string
  typology_id?: number | null
  floor?: string | null
  price?: number | null
  /** `sold` is deliberately absent: neither create path writes sold_by/sold_at,
   *  so a unit born sold would be a closed sale with no buyer. Sales close
   *  through the per-unit endpoint. */
  status?: Exclude<UnitStatus, 'sold'>
}

/**
 * Returns created AND skipped. Both matter: "0 created, 12 skipped" is what a
 * double-submit looks like, and a generic success toast hides it.
 */
export async function createUnitBatch(
  projectId: number,
  input: UnitBatchInput,
): Promise<{ created: number; skipped: number }> {
  const body = await api<Envelope<{ created: number; skipped: number }>>(
    `crm/projects/${projectId}/units/batch`,
    { method: 'POST', body: input },
  )

  return body.data
}

export async function updateUnit(
  projectId: number,
  unitId: number,
  input: { status: UnitStatus; sold_by?: number },
): Promise<CrmUnit> {
  const body = await api<Envelope<CrmUnit>>(`crm/projects/${projectId}/units/${unitId}`, {
    method: 'PATCH',
    body: input,
  })

  return body.data
}
