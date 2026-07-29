/**
 * Placeholder dataset for the UI mock.
 *
 * The types here are deliberately shaped like the API that C.1/C.2 will expose,
 * so swapping a screen onto the real backend is a change of data source, not a
 * rewrite of the component. Delete a slice of this file as each endpoint lands.
 */

export type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'won' | 'lost'
export type Operation = 'sell' | 'rent'
export type Origin =
  | 'favorite'
  | 'direct'
  | 'whatsapp'
  | 'shared'
  | 'price_drop'
  | 'saved_search'
export type ActivityType = 'message' | 'call' | 'visit' | 'note'
export type Lifecycle = 'draft' | 'published' | 'paused' | 'sold' | 'rejected'
export type Moderation = 'pending' | 'approved' | 'rejected'
export type UnitStatus = 'available' | 'reserved' | 'sold' | 'unavailable'

export interface Lead {
  id: number
  name: string
  phone: string
  email: string
  propertyCode: string
  propertyTitle: string
  operation: Operation
  stage: Stage
  /** D.1 lead score, 0-100. */
  score: number
  origin: Origin
  /** C.5 — null once the lead has been answered. */
  slaDueAt: string | null
  lastActivityAt: string
  createdAt: string
}

export interface Activity {
  id: number
  leadId: number
  type: ActivityType
  body: string
  at: string
}

export interface Task {
  id: number
  leadId: number | null
  title: string
  dueAt: string
  done: boolean
}

export interface Property {
  id: number
  code: string
  title: string
  city: string
  sector: string
  operation: Operation
  lifecycle: Lifecycle
  moderation: Moderation
  featured: boolean
  featuredExpiresAt: string | null
  price: number
  bedrooms: number
  bathrooms: number
  parking: number
  area: number
  leadsCount: number
  unansweredLeads: number
  createdAt: string
}

export interface Typology {
  id: number
  name: string
  bedrooms: number
  bathrooms: number
  area: number
  basePrice: number
  unitsTotal: number
  unitsAvailable: number
}

export interface Unit {
  id: number
  identifier: string
  floor: number
  price: number
  status: UnitStatus
  typologyId: number
}

export interface Project {
  id: number
  name: string
  city: string
  sector: string
  status: 'preselling' | 'building' | 'delivered' | 'sold_out'
  priceFrom: number
  priceTo: number
  typologies: Typology[]
  units: Unit[]
}

export interface NotificationItem {
  id: number
  type: 'featured_expiring' | 'price_drop' | 'lead_created' | 'sla_breached'
  title: string
  body: string
  at: string
  read: boolean
}

const HOUR = 3_600_000
const DAY = 86_400_000
const now = Date.now()
const at = (offsetMs: number): string => new Date(now + offsetMs).toISOString()

export const LEADS: Lead[] = [
  { id: 1, name: 'María Peralta', phone: '+1 809 555 0142', email: 'maria.peralta@example.do', propertyCode: 'RF0412', propertyTitle: 'Apartamento en Piantini', operation: 'sell', stage: 'new', score: 92, origin: 'price_drop', slaDueAt: at(4 * HOUR), lastActivityAt: at(-2 * HOUR), createdAt: at(-20 * HOUR) },
  { id: 2, name: 'José Ramírez', phone: '+1 829 555 0187', email: 'jramirez@example.do', propertyCode: 'RF0288', propertyTitle: 'Local comercial en Naco', operation: 'rent', stage: 'new', score: 71, origin: 'whatsapp', slaDueAt: at(-3 * HOUR), lastActivityAt: at(-2 * DAY), createdAt: at(-2 * DAY) },
  { id: 3, name: 'Ana Michel Cruz', phone: '+1 809 555 0119', email: 'ana.cruz@example.do', propertyCode: 'RF0913', propertyTitle: 'Villa en Punta Cana', operation: 'sell', stage: 'visit', score: 55, origin: 'saved_search', slaDueAt: null, lastActivityAt: at(-6 * HOUR), createdAt: at(-9 * DAY) },
  { id: 4, name: 'Luis Fernández', phone: '+1 849 555 0163', email: 'lfernandez@example.do', propertyCode: 'RF0412', propertyTitle: 'Apartamento en Piantini', operation: 'sell', stage: 'contacted', score: 78, origin: 'favorite', slaDueAt: null, lastActivityAt: at(-1 * DAY), createdAt: at(-5 * DAY) },
  { id: 5, name: 'Carolina Batista', phone: '+1 809 555 0155', email: 'cbatista@example.do', propertyCode: 'RF0755', propertyTitle: 'Penthouse en Bella Vista', operation: 'sell', stage: 'negotiation', score: 88, origin: 'direct', slaDueAt: null, lastActivityAt: at(-4 * HOUR), createdAt: at(-22 * DAY) },
  { id: 6, name: 'Pedro Objío', phone: '+1 829 555 0171', email: 'pobjio@example.do', propertyCode: 'RF0640', propertyTitle: 'Casa en Arroyo Hondo', operation: 'sell', stage: 'contacted', score: 46, origin: 'shared', slaDueAt: null, lastActivityAt: at(-3 * DAY), createdAt: at(-11 * DAY) },
  { id: 7, name: 'Rosa Guzmán', phone: '+1 809 555 0128', email: 'rguzman@example.do', propertyCode: 'RF0288', propertyTitle: 'Local comercial en Naco', operation: 'rent', stage: 'new', score: 34, origin: 'direct', slaDueAt: at(11 * HOUR), lastActivityAt: at(-30 * 60_000), createdAt: at(-30 * 60_000) },
  { id: 8, name: 'Frank Then', phone: '+1 849 555 0192', email: 'fthen@example.do', propertyCode: 'RF1024', propertyTitle: 'Apartamento en Evaristo Morales', operation: 'rent', stage: 'visit', score: 63, origin: 'saved_search', slaDueAt: null, lastActivityAt: at(-8 * HOUR), createdAt: at(-6 * DAY) },
  { id: 9, name: 'Yamilet Reyes', phone: '+1 809 555 0134', email: 'yreyes@example.do', propertyCode: 'RF0755', propertyTitle: 'Penthouse en Bella Vista', operation: 'sell', stage: 'won', score: 95, origin: 'favorite', slaDueAt: null, lastActivityAt: at(-2 * DAY), createdAt: at(-40 * DAY) },
  { id: 10, name: 'Ramón Castillo', phone: '+1 829 555 0146', email: 'rcastillo@example.do', propertyCode: 'RF0640', propertyTitle: 'Casa en Arroyo Hondo', operation: 'sell', stage: 'lost', score: 22, origin: 'whatsapp', slaDueAt: null, lastActivityAt: at(-15 * DAY), createdAt: at(-38 * DAY) },
  { id: 11, name: 'Alejandra Nin', phone: '+1 809 555 0177', email: 'anin@example.do', propertyCode: 'RF0913', propertyTitle: 'Villa en Punta Cana', operation: 'sell', stage: 'negotiation', score: 81, origin: 'price_drop', slaDueAt: null, lastActivityAt: at(-12 * HOUR), createdAt: at(-27 * DAY) },
  { id: 12, name: 'Héctor Made', phone: '+1 849 555 0158', email: 'hmade@example.do', propertyCode: 'RF1024', propertyTitle: 'Apartamento en Evaristo Morales', operation: 'rent', stage: 'contacted', score: 58, origin: 'direct', slaDueAt: null, lastActivityAt: at(-2 * DAY), createdAt: at(-8 * DAY) },
]

export const ACTIVITIES: Activity[] = [
  { id: 1, leadId: 1, type: 'message', body: 'Vi que bajó de precio, ¿sigue disponible para visitar este fin de semana?', at: at(-2 * HOUR) },
  { id: 2, leadId: 1, type: 'note', body: 'Llegó por notificación de bajada de precio. Etiquetar como caliente.', at: at(-2 * HOUR) },
  { id: 3, leadId: 1, type: 'call', body: 'Llamada sin respuesta. Reintentar en la tarde.', at: at(-90 * 60_000) },
  { id: 4, leadId: 3, type: 'visit', body: 'Visita realizada. Le gustó la terraza, preguntó por el mantenimiento.', at: at(-6 * HOUR) },
  { id: 5, leadId: 3, type: 'note', body: 'Pide comparativa con la villa de Bávaro antes de decidir.', at: at(-5 * HOUR) },
  { id: 6, leadId: 5, type: 'message', body: 'Enviada la oferta formal por RD$ 18,400,000.', at: at(-4 * HOUR) },
]

export const TASKS: Task[] = [
  { id: 1, leadId: 3, title: 'Seguimiento post-visita — Ana Michel Cruz', dueAt: at(18 * HOUR), done: false },
  { id: 2, leadId: 2, title: 'Responder a José Ramírez (SLA vencido)', dueAt: at(-3 * HOUR), done: false },
  { id: 3, leadId: 5, title: 'Confirmar contraoferta con Carolina Batista', dueAt: at(2 * DAY), done: false },
  { id: 4, leadId: 8, title: 'Coordinar segunda visita con Frank Then', dueAt: at(3 * DAY), done: false },
  { id: 5, leadId: null, title: 'Renovar destacado de RF0412', dueAt: at(2 * DAY), done: false },
  { id: 6, leadId: 11, title: 'Enviar planos a Alejandra Nin', dueAt: at(-1 * DAY), done: true },
]

export const PROPERTIES: Property[] = [
  { id: 1, code: 'RF0412', title: 'Apartamento en Piantini', city: 'Santo Domingo', sector: 'Piantini', operation: 'sell', lifecycle: 'published', moderation: 'approved', featured: true, featuredExpiresAt: at(2 * DAY), price: 14_500_000, bedrooms: 3, bathrooms: 3, parking: 2, area: 210, leadsCount: 2, unansweredLeads: 1, createdAt: at(-60 * DAY) },
  { id: 2, code: 'RF0288', title: 'Local comercial en Naco', city: 'Santo Domingo', sector: 'Naco', operation: 'rent', lifecycle: 'published', moderation: 'approved', featured: false, featuredExpiresAt: null, price: 95_000, bedrooms: 0, bathrooms: 2, parking: 3, area: 180, leadsCount: 2, unansweredLeads: 2, createdAt: at(-45 * DAY) },
  { id: 3, code: 'RF0913', title: 'Villa en Punta Cana', city: 'Punta Cana', sector: 'Cocotal', operation: 'sell', lifecycle: 'published', moderation: 'approved', featured: true, featuredExpiresAt: at(9 * DAY), price: 27_900_000, bedrooms: 4, bathrooms: 5, parking: 2, area: 420, leadsCount: 2, unansweredLeads: 0, createdAt: at(-90 * DAY) },
  { id: 4, code: 'RF0755', title: 'Penthouse en Bella Vista', city: 'Santo Domingo', sector: 'Bella Vista', operation: 'sell', lifecycle: 'sold', moderation: 'approved', featured: false, featuredExpiresAt: null, price: 18_400_000, bedrooms: 3, bathrooms: 4, parking: 2, area: 265, leadsCount: 2, unansweredLeads: 0, createdAt: at(-120 * DAY) },
  { id: 5, code: 'RF0640', title: 'Casa en Arroyo Hondo', city: 'Santo Domingo', sector: 'Arroyo Hondo', operation: 'sell', lifecycle: 'paused', moderation: 'approved', featured: false, featuredExpiresAt: null, price: 11_200_000, bedrooms: 4, bathrooms: 3, parking: 4, area: 310, leadsCount: 2, unansweredLeads: 0, createdAt: at(-75 * DAY) },
  { id: 6, code: 'RF1024', title: 'Apartamento en Evaristo Morales', city: 'Santo Domingo', sector: 'Evaristo Morales', operation: 'rent', lifecycle: 'published', moderation: 'approved', featured: false, featuredExpiresAt: null, price: 68_000, bedrooms: 2, bathrooms: 2, parking: 1, area: 120, leadsCount: 2, unansweredLeads: 0, createdAt: at(-30 * DAY) },
  { id: 7, code: 'RF1108', title: 'Solar en Santiago', city: 'Santiago', sector: 'Gurabo', operation: 'sell', lifecycle: 'rejected', moderation: 'rejected', featured: false, featuredExpiresAt: null, price: 4_800_000, bedrooms: 0, bathrooms: 0, parking: 0, area: 800, leadsCount: 0, unansweredLeads: 0, createdAt: at(-12 * DAY) },
  { id: 8, code: 'RF1130', title: 'Apartamento en Bávaro', city: 'Punta Cana', sector: 'Bávaro', operation: 'rent', lifecycle: 'draft', moderation: 'pending', featured: false, featuredExpiresAt: null, price: 55_000, bedrooms: 2, bathrooms: 2, parking: 1, area: 96, leadsCount: 0, unansweredLeads: 0, createdAt: at(-3 * DAY) },
]

export const PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Torre Almendra',
    city: 'Santo Domingo',
    sector: 'Evaristo Morales',
    status: 'preselling',
    priceFrom: 8_900_000,
    priceTo: 16_400_000,
    typologies: [
      { id: 1, name: 'Tipo A — 1 hab', bedrooms: 1, bathrooms: 1, area: 68, basePrice: 8_900_000, unitsTotal: 12, unitsAvailable: 7 },
      { id: 2, name: 'Tipo B — 2 hab', bedrooms: 2, bathrooms: 2, area: 104, basePrice: 12_300_000, unitsTotal: 16, unitsAvailable: 9 },
      { id: 3, name: 'Tipo C — 3 hab', bedrooms: 3, bathrooms: 3, area: 148, basePrice: 16_400_000, unitsTotal: 8, unitsAvailable: 2 },
    ],
    units: [
      { id: 1, identifier: '301', floor: 3, price: 8_900_000, status: 'available', typologyId: 1 },
      { id: 2, identifier: '302', floor: 3, price: 9_100_000, status: 'reserved', typologyId: 1 },
      { id: 3, identifier: '303', floor: 3, price: 12_300_000, status: 'sold', typologyId: 2 },
      { id: 4, identifier: '401', floor: 4, price: 12_600_000, status: 'available', typologyId: 2 },
      { id: 5, identifier: '402', floor: 4, price: 16_400_000, status: 'available', typologyId: 3 },
      { id: 6, identifier: '403', floor: 4, price: 16_900_000, status: 'unavailable', typologyId: 3 },
    ],
  },
  {
    id: 2,
    name: 'Residencial Cocotal Green',
    city: 'Punta Cana',
    sector: 'Cocotal',
    status: 'building',
    priceFrom: 13_500_000,
    priceTo: 24_000_000,
    typologies: [
      { id: 4, name: 'Villa 2 hab', bedrooms: 2, bathrooms: 2, area: 145, basePrice: 13_500_000, unitsTotal: 10, unitsAvailable: 4 },
      { id: 5, name: 'Villa 3 hab', bedrooms: 3, bathrooms: 4, area: 210, basePrice: 24_000_000, unitsTotal: 6, unitsAvailable: 1 },
    ],
    units: [
      { id: 7, identifier: 'V-01', floor: 1, price: 13_500_000, status: 'available', typologyId: 4 },
      { id: 8, identifier: 'V-02', floor: 1, price: 13_900_000, status: 'sold', typologyId: 4 },
      { id: 9, identifier: 'V-07', floor: 1, price: 24_000_000, status: 'reserved', typologyId: 5 },
    ],
  },
  {
    id: 3,
    name: 'Altos de Gurabo',
    city: 'Santiago',
    sector: 'Gurabo',
    status: 'sold_out',
    priceFrom: 6_200_000,
    priceTo: 9_800_000,
    typologies: [
      { id: 6, name: 'Tipo único', bedrooms: 3, bathrooms: 2, area: 130, basePrice: 6_200_000, unitsTotal: 14, unitsAvailable: 0 },
    ],
    units: [],
  },
]

export const NOTIFICATIONS: NotificationItem[] = [
  { id: 1, type: 'featured_expiring', title: 'Tu destacado vence en 2 días', body: 'RF0412 generó 120 visitas y 8 contactos mientras estuvo destacado.', at: at(-1 * HOUR), read: false },
  { id: 2, type: 'sla_breached', title: 'Lead sin responder', body: 'José Ramírez lleva 27 horas esperando respuesta en RF0288.', at: at(-3 * HOUR), read: false },
  { id: 3, type: 'lead_created', title: 'Nuevo lead', body: 'Rosa Guzmán preguntó por RF0288.', at: at(-30 * 60_000), read: false },
  { id: 4, type: 'price_drop', title: 'Bajada de precio publicada', body: 'RF0412 bajó 6% — notificados 14 favoritos y 3 búsquedas guardadas.', at: at(-1 * DAY), read: true },
]

/** C.5 — a lead is breaching when its SLA deadline is already in the past. */
export function isSlaBreached(lead: Lead): boolean {
  return lead.slaDueAt !== null && new Date(lead.slaDueAt).getTime() < Date.now()
}

/** D.1 bands: 80-100 very hot, 60-79 hot, 40-59 warm, 0-39 cold. */
export function scoreBand(score: number): 'hot' | 'warm' | 'mild' | 'cold' {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  if (score >= 40) return 'mild'
  return 'cold'
}
