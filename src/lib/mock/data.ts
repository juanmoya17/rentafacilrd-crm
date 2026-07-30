/**
 * What is still placeholder data.
 *
 * Leads, contacts, activities and tasks left this file when C.2 landed, and
 * properties left when A.1–A.8 landed — they now come from /api/crm, typed in
 * `src/lib/crm/types.ts`. What remains has no endpoint yet: projects
 * (E.1–E.8) and notifications (B.2/B.3). Delete the matching slice as each
 * one ships.
 */

export type UnitStatus = 'available' | 'reserved' | 'sold' | 'unavailable'

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
