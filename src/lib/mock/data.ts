/**
 * What is still placeholder data.
 *
 * Leads, contacts, activities and tasks left this file when C.2 landed,
 * properties left when A.1–A.8 landed, and projects left when M8 phase 5b
 * wired E.1–E.8 — they now come from /api/crm, typed in `src/lib/crm/`. Only
 * notifications (B.2) have no endpoint yet. Delete the slice as it ships.
 */

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

export const NOTIFICATIONS: NotificationItem[] = [
  { id: 1, type: 'featured_expiring', title: 'Tu destacado vence en 2 días', body: 'RF0412 generó 120 visitas y 8 contactos mientras estuvo destacado.', at: at(-1 * HOUR), read: false },
  { id: 2, type: 'sla_breached', title: 'Lead sin responder', body: 'José Ramírez lleva 27 horas esperando respuesta en RF0288.', at: at(-3 * HOUR), read: false },
  { id: 3, type: 'lead_created', title: 'Nuevo lead', body: 'Rosa Guzmán preguntó por RF0288.', at: at(-30 * 60_000), read: false },
  { id: 4, type: 'price_drop', title: 'Bajada de precio publicada', body: 'RF0412 bajó 6% — notificados 14 favoritos y 3 búsquedas guardadas.', at: at(-1 * DAY), read: true },
]
