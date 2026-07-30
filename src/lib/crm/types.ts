/**
 * Wire shapes for /api/crm — mirrors CrmLeadResource, CrmContactResource,
 * CrmActivityResource and CrmTaskResource. Keys stay snake_case exactly as the
 * API sends them, so a mismatch is a compile error and not a silent undefined.
 */

export type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'won' | 'lost'

export type Origin =
  | 'favorite'
  | 'direct'
  | 'whatsapp'
  | 'shared'
  | 'price_drop'
  | 'saved_search'

export type ActivityType = 'message' | 'call' | 'visit' | 'note'

export type ScoreBand = 'hot' | 'warm' | 'mild' | 'cold'

export const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'won', 'lost']

export interface CrmContact {
  id: number
  name: string
  email: string | null
  phone: string | null
  customer_id: number | null
  created_at?: string | null
}

export interface CrmActivity {
  id: number
  type: ActivityType
  body: string | null
  occurred_at: string | null
  author_id: number | null
}

export interface CrmTask {
  id: number
  title: string
  lead_id: number | null
  due_at: string | null
  remind_at: string | null
  done_at: string | null
  is_done: boolean
  is_overdue: boolean
}

export interface CrmLead {
  id: number
  stage: Stage
  origin: Origin
  score: number
  /**
   * Absent until D.1 computes a real score. The API deliberately stopped
   * sending it rather than emit a constant "cold" band off a score nothing
   * writes — so treat null as "no signal yet" and render nothing, not a
   * neutral badge that looks like a measurement.
   */
  score_band?: ScoreBand | null
  contact: CrmContact | null
  property_id: number | null
  property_title: string | null
  property_slug: string | null
  sla_due_at: string | null
  first_response_at: string | null
  is_sla_breached: boolean
  last_activity_at: string | null
  closed_at: string | null
  created_at: string | null
  /** Only present on the detail endpoint. */
  activities?: CrmActivity[]
  tasks?: CrmTask[]
}

/** Seven, from PropertyStateMapper::LIFECYCLES. The old mock had five. */
export type Lifecycle =
  | 'draft'
  | 'published'
  | 'paused'
  | 'expired'
  | 'sold'
  | 'rented'
  | 'rejected'

export type Operation = 'sell' | 'rent'

export type Moderation = 'pending' | 'approved' | 'rejected'

export const LIFECYCLES: Lifecycle[] = [
  'draft', 'published', 'paused', 'expired', 'sold', 'rented', 'rejected',
]

/** Five, from BulkPropertyAction::ACTIONS. `close` closes a sale as sold and a rental as rented. */
export type BulkAction = 'publish' | 'pause' | 'feature' | 'close' | 'delete'

export const BULK_ACTIONS: BulkAction[] = ['publish', 'pause', 'feature', 'close', 'delete']

/** The server caps a batch at 200 ids (CrmPropertyController::MAX_BATCH). */
export const MAX_BATCH = 200

export interface CrmProperty {
  id: number
  /** Derived RF#### — sent by the API, never stored. */
  code: string
  title: string
  city: string | null
  city_id: number | null
  price: number | null
  area: number | null
  /** No parking figure exists in this installation — do not reintroduce one. */
  bedrooms: number | null
  bathrooms: number | null
  /** NULL means not yet derived (see migration 2026_07_29_000002's backfill note);
   *  render nothing, not a default — same discipline as `operation` below. */
  lifecycle: Lifecycle | null
  /** Null for rows with no operation (projects); render nothing, not a default. */
  operation: Operation | null
  /** NULL means not yet derived — see `lifecycle` above. */
  moderation: Moderation | null
  leads_count: number
  unanswered_leads: number
  /** When the active advertisement's window closes. Null when not featured, or pending approval. */
  featured_expires_at: string | null
  created_at: string | null
  /** The agent's own listing copy. Null on a draft nobody has written yet. */
  description: string | null
  /**
   * Photo URLs, listing order, cover first. Always an array — a listing with
   * no photos sends `[]`, never null, so every consumer can `.length` it
   * without a guard. The UI must still render something for the empty case:
   * a draft with no photos is normal, not an error.
   */
  images: string[]
  /**
   * WGS84. Both null together or both set together — a listing is geocoded or
   * it is not, and a half-located pin is worse than no pin. Null is common:
   * the address may be deliberately withheld until a lead qualifies.
   */
  lat: number | null
  lng: number | null
}

export interface PropertySummary {
  total: number
  published: number
  new_leads: number
  expiring_featured: number
  featured_balance: { total: number; unlimited: boolean }
}

/** A.6 — four categories from two sources (Properties + CRM). */
export type RailBucketKey = 'rejected' | 'expiring_featured' | 'sla_breached' | 'overdue_tasks'

/**
 * A bucket with `count === 0` is never sent — omitted entirely, not zeroed.
 * `total` is the sum of all four underlying counts, including the omitted
 * ones, so a client can decide whether to render the rail at all with one
 * `total > 0` check regardless of which buckets are present.
 */
export interface ActionRail {
  buckets: { key: RailBucketKey; count: number }[]
  total: number
}

/** The 409 body when a batch does not fit. Exact shape of BulkPropertyAction::shortfall(). */
export interface Shortfall {
  need: number
  have: number
  short: number
}
