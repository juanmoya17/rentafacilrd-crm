/**
 * `/api/crm/property-shares*` — colaboración entre agentes.
 *
 * No confundir con `crm/agency.ts`: aquello es pertenecer a una empresa, esto
 * es un acuerdo puntual sobre UN inmueble, y sirve igual dentro de la misma
 * agencia que entre dos distintas.
 *
 * Claves en snake_case como las manda la API, misma regla que el resto: un
 * desajuste tiene que ser un error de compilación y no un `undefined` callado.
 */

import { api, apiUrl } from '@/lib/api'
import type { Envelope } from './api'

/** El orden es el que ve el usuario en el desplegable. */
export const CONTRACT_TYPES = ['co_brokerage', 'referral', 'shared_exclusive'] as const

export type ContractType = (typeof CONTRACT_TYPES)[number]

export const SHARE_STATUSES = ['pending', 'active', 'rejected', 'revoked'] as const

export type ShareStatus = (typeof SHARE_STATUSES)[number]

/** Congelado el día de la firma; no se relee del inmueble ni del perfil. */
export interface ContractParty {
  customer_id: number
  name: string | null
  identification: string | null
  agency_id: number | null
  agency_name: string | null
}

export interface ContractProperty {
  id: number
  title: string | null
  slug_id: string | null
  address: string | null
}

export interface PropertyShare {
  id: number
  status: ShareStatus
  contract_type: ContractType
  commission_pct: number
  /** null cuando el anuncio se borró: el contrato sobrevive, el enlace no. */
  property_id: number | null
  property: ContractProperty | null
  owner: ContractParty | null
  collaborator: ContractParty | null
  /** Lo resuelve el servidor para no reimplementar aquí quién puede qué. */
  is_owner: boolean
  accepted_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  revoked_reason: string | null
  created_at: string | null
}

export interface CollaboratorOption {
  id: number
  name: string | null
  profile: string | null
  agency_name: string | null
}

export type ShareFilters = {
  role?: 'owner' | 'collaborator'
  status?: ShareStatus
  offset?: number
  limit?: number
}

export async function listShares(
  filters: ShareFilters = {},
  signal?: AbortSignal,
): Promise<{ shares: PropertyShare[]; total: number }> {
  const envelope = await api<Envelope<PropertyShare[]>>(
    `crm/property-shares${query(filters)}`,
    { signal },
  )

  return { shares: envelope.data, total: envelope.total ?? envelope.data.length }
}

/**
 * El buscador exige dos caracteres —el servidor responde 422 con menos—, así
 * que la pantalla no debe llamar antes de tenerlos.
 */
export const MIN_SEARCH = 2

export async function searchCollaborators(
  term: string,
  signal?: AbortSignal,
): Promise<CollaboratorOption[]> {
  const envelope = await api<Envelope<CollaboratorOption[]>>(
    `crm/property-shares/collaborators${query({ q: term })}`,
    { signal },
  )

  return envelope.data
}

export async function createShare(input: {
  property_id: number
  collaborator_id: number
  contract_type: ContractType
  commission_pct: number
}): Promise<PropertyShare> {
  const envelope = await api<Envelope<PropertyShare>>('crm/property-shares', {
    method: 'POST',
    body: input,
  })

  return envelope.data
}

export async function acceptShare(id: number): Promise<void> {
  await api<Envelope<unknown>>(`crm/property-shares/${id}/accept`, { method: 'POST' })
}

export async function rejectShare(id: number): Promise<void> {
  await api<Envelope<unknown>>(`crm/property-shares/${id}/reject`, { method: 'POST' })
}

/** El motivo es obligatorio: el servidor responde 422 sin él. */
export async function revokeShare(id: number, reason: string): Promise<void> {
  await api<Envelope<unknown>>(`crm/property-shares/${id}/revoke`, {
    method: 'POST',
    body: { reason },
  })
}

/**
 * La URL del contrato en PDF. Se abre en una pestaña en vez de descargarse por
 * fetch: la respuesta no es la envoltura JSON del resto y el navegador ya sabe
 * enseñar un PDF.
 */
export function contractUrl(id: number): string {
  return apiUrl(`crm/property-shares/${id}/contract`)
}

export interface CollaboratorLeadGroup {
  collaborator_id: number
  collaborator_name: string | null
  share_status: ShareStatus
  leads: { id: number; stage: string; contact: { name: string | null } | null }[]
}

/**
 * Los leads que los colaboradores captaron sobre un anuncio propio. Solo
 * lectura: son suyos, y el dueño los ve porque salieron de su inmueble.
 */
export async function listCollaboratorLeads(
  propertyId: number,
  signal?: AbortSignal,
): Promise<{ groups: CollaboratorLeadGroup[]; total: number }> {
  const envelope = await api<Envelope<CollaboratorLeadGroup[]>>(
    `crm/properties/${propertyId}/collaborator-leads`,
    { signal },
  )

  return { groups: envelope.data, total: envelope.total ?? 0 }
}

/** Igual que el `query()` de crm/agency.ts, que es privado de ese módulo. */
function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs === '' ? '' : `?${qs}`
}
