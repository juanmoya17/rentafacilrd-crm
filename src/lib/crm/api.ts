import { api } from '@/lib/api'
import type {
  ActivityType,
  CrmContact,
  CrmLead,
  CrmTask,
  Stage,
} from './types'

/**
 * Every CRM response is the platform envelope. `total` rides alongside `data`
 * at the top level (ApiResponseService merges customData there), which is what
 * the list screens read for their result count.
 */
interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

export interface Page<T> {
  items: T[]
  total: number
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs === '' ? '' : `?${qs}`
}

// `type`, not `interface`: only a type alias gets the implicit index signature
// that lets it be passed to query() without restating every key.
export type LeadFilters = {
  stage?: Stage
  sla?: 'breached'
  q?: string
  property_id?: number
  offset?: number
  limit?: number
}

export async function listLeads(
  filters: LeadFilters = {},
  signal?: AbortSignal,
): Promise<Page<CrmLead>> {
  const response = await api<Envelope<CrmLead[]>>(`crm/leads${query(filters)}`, { signal })
  return { items: response.data, total: response.total ?? response.data.length }
}

export async function getLead(id: number, signal?: AbortSignal): Promise<CrmLead> {
  const response = await api<Envelope<CrmLead>>(`crm/leads/${id}`, { signal })
  return response.data
}

export async function updateLeadStage(id: number, stage: Stage): Promise<CrmLead> {
  const response = await api<Envelope<CrmLead>>(`crm/leads/${id}`, {
    method: 'PATCH',
    body: { stage },
  })
  return response.data
}

export async function addActivity(
  leadId: number,
  payload: { type: ActivityType; body?: string },
): Promise<CrmLead> {
  const response = await api<Envelope<CrmLead>>(`crm/leads/${leadId}/activities`, {
    method: 'POST',
    body: payload,
  })
  return response.data
}

export type TaskFilters = {
  status?: 'pending' | 'done' | 'overdue'
  lead_id?: number
  offset?: number
  limit?: number
}

export async function listTasks(
  filters: TaskFilters = {},
  signal?: AbortSignal,
): Promise<Page<CrmTask>> {
  const response = await api<Envelope<CrmTask[]>>(`crm/tasks${query(filters)}`, { signal })
  return { items: response.data, total: response.total ?? response.data.length }
}

export async function setTaskDone(id: number, isDone: boolean): Promise<CrmTask> {
  const response = await api<Envelope<CrmTask>>(`crm/tasks/${id}`, {
    method: 'PATCH',
    body: { is_done: isDone },
  })
  return response.data
}

export type ContactFilters = { q?: string; offset?: number; limit?: number }

export async function listContacts(
  filters: ContactFilters = {},
  signal?: AbortSignal,
): Promise<Page<CrmContact>> {
  const response = await api<Envelope<CrmContact[]>>(`crm/contacts${query(filters)}`, { signal })
  return { items: response.data, total: response.total ?? response.data.length }
}
