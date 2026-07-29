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
  score_band: ScoreBand
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
