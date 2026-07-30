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
  lifecycle: Lifecycle
  /** Null for rows with no operation (projects); render nothing, not a default. */
  operation: Operation | null
  moderation: Moderation
  leads_count: number
  unanswered_leads: number
  /** When the active advertisement's window closes. Null when not featured, or pending approval. */
  featured_expires_at: string | null
  created_at: string | null
}

export interface PropertySummary {
  total: number
  published: number
  new_leads: number
  expiring_featured: number
  featured_balance: { total: number; unlimited: boolean }
}

/** The 409 body when a batch does not fit. Exact shape of BulkPropertyAction::shortfall(). */
export interface Shortfall {
  need: number
  have: number
  short: number
}
