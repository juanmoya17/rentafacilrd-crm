/**
 * `/api/crm/agency*` — la agencia, su equipo y sus invitaciones.
 *
 * Espeja AgencyResource, CrmAgencyMemberResource y CrmAgencyInvitationResource.
 * Las claves se quedan en snake_case exactamente como las manda la API, para
 * que un desajuste sea un error de compilación y no un `undefined` silencioso
 * —misma regla que types.ts.
 *
 * Todas las rutas de abajo exigen owner/admin salvo `getAgency`, que cualquier
 * miembro activo puede leer: un asesor necesita ver bajo qué marca trabaja.
 */

import { api } from '@/lib/api'
import type { Envelope } from './api'

export type AgencyRole = 'owner' | 'admin' | 'agent'
export type MemberStatus = 'active' | 'suspended' | 'ended'

export interface Agency {
  id: number
  slug_id: string
  name: string
  rnc: string | null
  phone: string | null
  email: string | null
  website: string | null
  description: string | null
  instagram: string | null
  facebook: string | null
  logo: string | null
  cover: string | null
  is_verified: boolean
}

export interface AgencyMember {
  /**
   * El id de MEMBRESÍA. Es lo que toman las rutas por miembro (rol, estado,
   * salida, preflight). `customer_id` es la PERSONA y es lo que toman
   * `to_customer_id` en la salida y en la reasignación de anuncios. Confundir
   * uno con otro responde 404 o 422 — nunca algo peor, pero tampoco algo que
   * el cliente pueda deducir si solo viajara uno.
   */
  id: number
  customer_id: number
  name: string | null
  email: string | null
  mobile: string | null
  profile: string | null
  role: AgencyRole
  status: MemberStatus
  joined_at: string | null
}

export interface AgencyInvitation {
  id: number
  role: Exclude<AgencyRole, 'owner'>
  email: string | null
  phone: string | null
  status: string
  /**
   * "¿Sirve todavía?". No se deriva de `status`: una invitación vencida sigue
   * diciendo `pending` hasta que pasa el comando diario que las barre, así que
   * el cliente no puede reimplementar la comparación de fechas.
   */
  is_open: boolean
  invited_by: string | null
  expires_at: string | null
  created_at: string | null
}

/** La única vez que el enlace es visible. En la base solo queda su hash. */
export interface CreatedInvitation {
  id: number
  role: AgencyRole
  email: string | null
  phone: string | null
  expires_at: string
  invite_url: string
}

export interface AgencyProfile {
  agency: Agency
  seats_used: number
  /** `null` = sin límite. Hay que distinguirlo de 0. */
  seats_limit: number | null
  /**
   * El rol de QUIEN PREGUNTA. El listado del equipo es solo de admin, así que
   * esta es la única lectura que hace un asesor: sin este campo, la pantalla
   * tendría que pedir el equipo y deducir el permiso del 403.
   */
  role: AgencyRole | null
  is_admin: boolean
}

export interface Roster {
  members: AgencyMember[]
  total: number
  seats_used: number
  seats_limit: number | null
  /**
   * Más miembros activos que plazas. Pasa cuando el plan del propietario baja
   * o caduca con el equipo ya montado: no se suspende a nadie, simplemente no
   * se puede invitar. Sin esto, una invitación vuelve 422 sin explicación.
   */
  over_capacity: boolean
}

export interface ExitPreflight {
  properties: number
  projects: number
  open_leads: number
  contacts: number
  open_tasks: number
}

type RosterEnvelope = Envelope<AgencyMember[]> & {
  seats_used: number
  seats_limit: number | null
  over_capacity: boolean
}

type ProfileEnvelope = Envelope<Agency> & {
  seats_used: number
  seats_limit: number | null
  role: AgencyRole | null
  is_admin: boolean
}

/**
 * Plazas usadas sobre plazas del plan. `null` es sin límite, y tiene que
 * distinguirse de 0 — "3 / 0" leería como un plan agotado cuando es lo
 * contrario.
 */
export function seatsLabel(used: number, limit: number | null): string {
  return `${used} / ${limit === null ? '\u221e' : limit}`
}

/**
 * ¿Se puede invitar a alguien más?
 *
 * Dos motivos distintos para que no: el equipo está justo en el tope, o está
 * POR ENCIMA porque el plan bajó con la gente ya dentro. El segundo no suspende
 * a nadie (decisión de F8), así que el único síntoma visible es este.
 */
export function canInvite(roster: Pick<Roster, 'seats_used' | 'seats_limit' | 'over_capacity'>): boolean {
  if (roster.over_capacity) return false

  return roster.seats_limit === null || roster.seats_used < roster.seats_limit
}

/** Qué sigue a nombre de quien se va. Cero en todo = la salida no mueve nada. */
export function holdsSomething(preflight: ExitPreflight): boolean {
  return (
    preflight.properties > 0 ||
    preflight.projects > 0 ||
    preflight.open_leads > 0 ||
    preflight.contacts > 0 ||
    preflight.open_tasks > 0
  )
}

/**
 * A quién se le puede traspasar la cartera de quien sale.
 *
 * Miembros activos menos quien se va. El servidor rechaza el auto-traspaso con
 * `bad_receiver`, pero la pantalla no debería llegar a ofrecerlo.
 */
export function exitReceivers(members: AgencyMember[], leavingMemberId: number): AgencyMember[] {
  return members.filter((m) => m.status === 'active' && m.id !== leavingMemberId)
}

/**
 * Qué nombre pintar en la etiqueta "Asignada a [nombre]" de una tarjeta de
 * propiedad o proyecto — o `null` si no hay que pintar nada.
 *
 * Dos guardas, y ninguna puede depender de que la otra corra primero:
 * - Es mi propio anuncio: "Asignada a mí" en todas mis filas es ruido.
 * - `myId` desconocido (la sesión todavía está cargando): falla cerrado —
 *   mejor no pintar una etiqueta un instante que pintar "Asignada a Ana"
 *   sobre el propio anuncio de Ana mientras el contexto de autenticación
 *   resuelve.
 *
 * `?? null` en el retorno, no un simple `return addedByName`: `added_by` y
 * `added_by_name` viajan tipados como requeridos porque el backend los manda
 * siempre, pero la rama que los manda no está mergeada, así que hoy llegan
 * `undefined` en cada fila. Sin esto, `undefined !== null` deja pasar el
 * guard de quien llama y `t()` interpola literalmente "Asignada a undefined".
 */
export function assignedAgentName(
  addedBy: number,
  addedByName: string | null,
  myId: number | undefined,
): string | null {
  if (myId === undefined || addedBy === myId) return null
  return addedByName ?? null
}

/**
 * Whether the "filter inventory by agent" control on /properties earns a
 * spot on screen.
 *
 * `ended` never counts even if the caller's roster somehow includes one
 * (today's default `listMembers()` already excludes them): whoever left had
 * their portfolio merged into a colleague's during the exit wizard, so there
 * is nothing left under their name to filter for. With one or zero
 * filterable members left, offering the control is offering a choice that
 * cannot change the result.
 */
export function canFilterByMember(members: AgencyMember[]): boolean {
  return members.filter((m) => m.status !== 'ended').length > 1
}

/** Igual que el `query()` de crm/api.ts, que es privado de ese módulo. */
function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs === '' ? '' : `?${qs}`
}

export async function getAgency(signal?: AbortSignal): Promise<AgencyProfile> {
  const envelope = await api<ProfileEnvelope>('crm/agency', { signal })

  return {
    agency: envelope.data,
    seats_used: envelope.seats_used,
    seats_limit: envelope.seats_limit,
    role: envelope.role,
    is_admin: envelope.is_admin,
  }
}

export type AgencyDraft = Partial<
  Pick<Agency, 'name' | 'rnc' | 'phone' | 'email' | 'website' | 'description' | 'instagram' | 'facebook'>
>

export async function updateAgency(draft: AgencyDraft): Promise<Agency> {
  const envelope = await api<Envelope<Agency>>('crm/agency', { method: 'PATCH', body: draft })

  return envelope.data
}

/**
 * Logo y portada van por su propia ruta, no dentro del PATCH: un formulario
 * obligado a reenviar todos los campos de texto para pasar la validación es
 * como una pantalla desactualizada pisa datos que nadie tocó.
 */
export async function uploadAgencyImage(kind: 'logo' | 'cover', file: File): Promise<Agency> {
  const body = new FormData()
  body.append(kind, file)

  const envelope = await api<Envelope<Agency>>(`crm/agency/${kind}`, { method: 'POST', body })

  return envelope.data
}

// `type`, not `interface`: solo un alias tiene la firma de índice implícita
// que deja pasarlo a query() sin reescribir cada clave.
export type RosterFilters = {
  /** Sin `status` salen activos y suspendidos. `ended` es el historial de salidas. */
  status?: MemberStatus | 'all'
  offset?: number
  limit?: number
}

export async function listMembers(
  filters: RosterFilters = {},
  signal?: AbortSignal,
): Promise<Roster> {
  const envelope = await api<RosterEnvelope>(`crm/agency/members${query(filters)}`, { signal })

  return {
    members: envelope.data,
    total: envelope.total ?? envelope.data.length,
    seats_used: envelope.seats_used,
    seats_limit: envelope.seats_limit,
    over_capacity: envelope.over_capacity,
  }
}

export type InvitationFilters = {
  status?: 'pending' | 'all'
  offset?: number
  limit?: number
}

export async function listInvitations(
  filters: InvitationFilters = {},
  signal?: AbortSignal,
): Promise<{ invitations: AgencyInvitation[]; total: number }> {
  const envelope = await api<Envelope<AgencyInvitation[]>>(
    `crm/agency/invitations${query(filters)}`,
    { signal },
  )

  return { invitations: envelope.data, total: envelope.total ?? envelope.data.length }
}

/**
 * Email O teléfono, nunca los dos: la tabla lo impone con un CHECK y mandar
 * ambos es un 422.
 */
export async function inviteMember(
  input: { email: string; role: Exclude<AgencyRole, 'owner'> } | { phone: string; role: Exclude<AgencyRole, 'owner'> },
): Promise<CreatedInvitation> {
  const envelope = await api<Envelope<CreatedInvitation>>('crm/agency/invitations', {
    method: 'POST',
    body: input,
  })

  return envelope.data
}

export async function cancelInvitation(id: number): Promise<void> {
  await api(`crm/agency/invitations/${id}`, { method: 'DELETE' })
}

export async function changeMemberRole(memberId: number, role: Exclude<AgencyRole, 'owner'>): Promise<void> {
  await api(`crm/agency/members/${memberId}/role`, { method: 'PATCH', body: { role } })
}

export async function changeMemberStatus(memberId: number, status: 'active' | 'suspended'): Promise<void> {
  await api(`crm/agency/members/${memberId}/status`, { method: 'PATCH', body: { status } })
}

/** Toma el id de MEMBRESÍA, no el de la persona. */
export async function transferOwnership(memberId: number): Promise<void> {
  await api('crm/agency/transfer-owner', { method: 'POST', body: { member_id: memberId } })
}

export async function exitPreflight(memberId: number, signal?: AbortSignal): Promise<ExitPreflight> {
  const envelope = await api<Envelope<ExitPreflight>>(
    `crm/agency/members/${memberId}/exit-preflight`,
    { signal },
  )

  return envelope.data
}

/** `toCustomerId` es el id de PERSONA de quien recibe la cartera. */
export async function exitMember(memberId: number, toCustomerId: number): Promise<void> {
  await api(`crm/agency/members/${memberId}/exit`, {
    method: 'POST',
    body: { to_customer_id: toCustomerId },
  })
}

export async function reassignListing(
  type: 'property' | 'project',
  id: number,
  toCustomerId: number,
): Promise<void> {
  await api('crm/agency/listings/reassign', {
    method: 'POST',
    body: { type, id, to_customer_id: toCustomerId },
  })
}

/** Un anuncio que un miembro trajo consigo y la agencia aún no ha incorporado. */
export interface ClaimableListing {
  listing_type: 'property' | 'project'
  id: number
  title: string | null
  slug_id: string | null
  image: string | null
  city: string | null
  price: string | number | null
  owner: string | null
}

/** El mismo techo que el lote de inventario. Uno para el producto, no dos. */
export const MAX_CLAIM = 200

/**
 * Clave de selección.
 *
 * La lista mezcla propiedades y proyectos, que numeran por separado: sin el
 * tipo delante, la propiedad 7 y el proyecto 7 son la misma entrada y marcar
 * una marca la otra. Es el fallo que incorpora el anuncio equivocado sin que
 * nada falle a la vista, por eso tiene test propio.
 */
export function claimKey(item: Pick<ClaimableListing, 'listing_type' | 'id'>): string {
  return `${item.listing_type}:${item.id}`
}

/** De vuelta a lo que espera el endpoint. */
export function claimKeyToItem(key: string): { type: 'property' | 'project'; id: number } {
  const [type, id] = key.split(':')

  return { type: type as 'property' | 'project', id: Number(id) }
}

export async function listClaimable(
  filters: { offset?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<{ items: ClaimableListing[]; total: number }> {
  const envelope = await api<Envelope<ClaimableListing[]>>(
    `crm/agency/claimable${query(filters)}`,
    { signal },
  )

  return { items: envelope.data, total: envelope.total ?? envelope.data.length }
}

export async function claimListings(keys: string[]): Promise<number> {
  const envelope = await api<Envelope<null> & { affected?: number }>('crm/agency/listings/claim', {
    method: 'POST',
    body: { items: keys.map(claimKeyToItem) },
  })

  return envelope.affected ?? 0
}
