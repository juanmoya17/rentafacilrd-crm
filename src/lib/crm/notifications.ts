import { api } from '@/lib/api'

/**
 * Wire shapes for /api/crm/notification-preferences.
 *
 * Only two channels exist: `push` and `email`. In-app rows are written
 * unconditionally before any preference is consulted, so there is nothing to
 * configure for them — a third channel here would be UI for a control that
 * changes nothing.
 */
export type NotificationChannel = 'push' | 'email'

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['push', 'email']

export type NotificationEventType =
  | 'lead_alerts'
  | 'listing_matches'
  | 'subscription'
  | 'reengagement'
  | 'meeting_updates'

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  'lead_alerts',
  'listing_matches',
  'subscription',
  'reengagement',
  'meeting_updates',
]

/**
 * The *resolved* baseline for this agent — not the raw system-default map.
 * It already accounts for the agent's legacy preference rows, so overlaying
 * `preferences` on top of this is what genuinely predicts a write's effect.
 * The client never reconstructs this itself; the server is the only source.
 */
export type NotificationDefaults = Record<NotificationEventType, Record<NotificationChannel, boolean>>

/**
 * A stored deviation from the baseline. The server stores only deviations —
 * a row exists exactly when its value differs from `defaults`, so a write
 * that lands back on the baseline deletes the row rather than storing it.
 */
export interface NotificationPreference {
  event_type: NotificationEventType
  channel: NotificationChannel
  enabled: boolean
}

export interface PropertyNotificationOverride {
  property_id: number
  event_type: NotificationEventType
  enabled: boolean
}

export interface NotificationPreferencesData {
  defaults: NotificationDefaults
  preferences: NotificationPreference[]
  overrides: PropertyNotificationOverride[]
}

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  code?: number
}

export async function getNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferencesData> {
  const response = await api<Envelope<NotificationPreferencesData>>('crm/notification-preferences', {
    signal,
  })
  return response.data
}

/** Resolves to the full refreshed snapshot — the caller adopts it rather than re-deriving locally. */
export async function setNotificationPreference(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<NotificationPreferencesData> {
  const response = await api<Envelope<NotificationPreferencesData>>('crm/notification-preferences', {
    method: 'PUT',
    body: { event_type: eventType, channel, enabled },
  })
  return response.data
}

export async function setPropertyOverride(
  propertyId: number,
  eventType: NotificationEventType,
  enabled: boolean,
): Promise<NotificationPreferencesData> {
  const response = await api<Envelope<NotificationPreferencesData>>(
    'crm/notification-preferences/property',
    { method: 'PUT', body: { property_id: propertyId, event_type: eventType, enabled } },
  )
  return response.data
}

/** Clears every stored deviation — preferences and property overrides alike. */
export async function resetNotificationPreferences(): Promise<NotificationPreferencesData> {
  const response = await api<Envelope<NotificationPreferencesData>>('crm/notification-preferences', {
    method: 'DELETE',
  })
  return response.data
}

/**
 * Overlays a `preferences` deviation list on the resolved `defaults` for one
 * event type + channel cell. Mirrors the server's cascade for rendering
 * only — the server remains the authority on what a write actually does.
 *
 * Pure and exported because it is the only part of this screen a test can
 * reach in this repo: no jsdom, no testing-library here.
 */
export function resolvePreference(
  defaults: NotificationDefaults,
  preferences: NotificationPreference[],
  eventType: NotificationEventType,
  channel: NotificationChannel,
): boolean {
  const explicit = preferences.find(
    (preference) => preference.event_type === eventType && preference.channel === channel,
  )
  return explicit?.enabled ?? defaults[eventType][channel]
}

/* ------------------------------------------------------------------ *
 * The inbox itself (B.2).
 *
 * These three endpoints are NOT under the /crm prefix — they are the same
 * `auth:sanctum` routes the Flutter app calls (`get_notification_list`,
 * `notification-unread-count`, `mark-notification-read`). There is no
 * CRM-specific inbox and there should not be one: the rows are per customer,
 * and a second endpoint would be a second read model to keep in sync with
 * the pivot that decides what "read" means.
 * ------------------------------------------------------------------ */

/**
 * Canonical categories, mirrored from the Flutter app's NotificationCategory
 * (lib/utils/notification/notification_category.dart). `chat` is kept even
 * though the CRM has no chat screen: the server can emit it, and dropping it
 * here would silently relabel those rows as `general`.
 */
export type NotificationCategory =
  | 'chat'
  | 'property'
  | 'lead'
  | 'saved_search'
  | 'favourite'
  | 'review_request'
  | 'review_received'
  | 'payment'
  | 'subscription'
  | 'reengagement'
  | 'advertisement'
  | 'advertisement_request'
  | 'meeting'
  | 'property_inquiry'
  | 'project_inquiry'
  | 'verification'
  | 'general'

/** Mirrors kMeetingNotificationTypes — meetings carry their subtype directly, never a group name. */
const MEETING_TYPES = new Set([
  'meeting_requested',
  'meeting_slots_proposed',
  'meeting_slot_selected',
  'meeting_approved',
  'meeting_rejected',
  'meeting_cancelled',
])

const STRING_TO_CATEGORY: Record<string, NotificationCategory> = {
  chat: 'chat',
  property: 'property',
  new_property_listing: 'property',
  lead: 'lead',
  saved_search: 'saved_search',
  favourite: 'favourite',
  review_request: 'review_request',
  review_received: 'review_received',
  payment: 'payment',
  subscription: 'subscription',
  subscription_expiring_soon: 'subscription',
  reengagement: 'reengagement',
  advertisement: 'advertisement',
  advertisement_request: 'advertisement_request',
  property_inquiry: 'property_inquiry',
  project_inquiry: 'project_inquiry',
  agent_verification: 'verification',
  user_verification: 'verification',
  default: 'general',
}

/**
 * Same hybrid resolution as the app's categoryFromStrings, and for the same
 * reason: `event_type` is the modern string, `type` is a tinyInteger column
 * that older rows filled with a numeric code, and rows predating the helper
 * have neither. Falling back to `general` is the honest answer — inventing a
 * category from a number would put a wrong label on a real notification.
 */
export function categoryOf(input: { event_type?: string | null; type?: string | null }): NotificationCategory {
  const event = input.event_type?.trim() ?? ''
  if (event !== '') {
    if (MEETING_TYPES.has(event)) return 'meeting'
    const byEvent = STRING_TO_CATEGORY[event]
    if (byEvent !== undefined) return byEvent
  }

  const type = input.type?.trim() ?? ''
  if (type !== '') {
    if (MEETING_TYPES.has(type)) return 'meeting'
    const byType = STRING_TO_CATEGORY[type]
    if (byType !== undefined) return byType
    if (type === '1') return 'property_inquiry'
  }

  return 'general'
}

export interface InboxNotification {
  id: number
  title: string
  message: string
  /** tinyInteger column, so it arrives as a number for modern rows and a legacy code for old ones. */
  type: string | null
  event_type: string | null
  created_at: string
  /** Server-rendered "hace 3 horas" — ignored here; the CRM formats from created_at in the active locale. */
  created?: string
  notification_image?: string
  is_read: boolean
  propertys_id?: number | null
  target_id?: number | null
}

interface InboxEnvelope {
  error: boolean
  message?: string
  /** Absent on the empty response — ApiController omits it rather than sending 0. */
  total?: number
  data: unknown[]
}

export interface InboxPage {
  items: InboxNotification[]
  total: number
}

/** Coerces one wire row. `type` is a tinyInteger on the way out, so it can arrive as a number. */
function toInboxNotification(row: unknown): InboxNotification | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>
  const id = Number(record.id)
  if (!Number.isFinite(id)) return null

  const asString = (value: unknown): string | null =>
    value === null || value === undefined ? null : String(value)

  return {
    id,
    title: typeof record.title === 'string' ? record.title : '',
    message: typeof record.message === 'string' ? record.message : '',
    type: asString(record.type),
    event_type: asString(record.event_type),
    created_at: typeof record.created_at === 'string' ? record.created_at : '',
    created: typeof record.created === 'string' ? record.created : undefined,
    notification_image:
      typeof record.notification_image === 'string' && record.notification_image !== ''
        ? record.notification_image
        : undefined,
    is_read: record.is_read === true,
    propertys_id: record.propertys_id === null || record.propertys_id === undefined ? null : Number(record.propertys_id),
    target_id: record.target_id === null || record.target_id === undefined ? null : Number(record.target_id),
  }
}

export async function fetchNotifications(
  { offset = 0, limit = 20 }: { offset?: number; limit?: number },
  signal?: AbortSignal,
): Promise<InboxPage> {
  const response = await api<InboxEnvelope>(
    `get_notification_list?offset=${offset}&limit=${limit}`,
    { signal },
  )
  const items = response.data.map(toInboxNotification).filter((item): item is InboxNotification => item !== null)
  // `total` is missing on the empty response, and falling back to items.length
  // there is right: zero rows, zero total. Falling back on a NON-empty page
  // would understate it, which is why this reads the field first.
  return { items, total: response.total ?? items.length }
}

export async function fetchUnreadCount(signal?: AbortSignal): Promise<number> {
  const response = await api<{ error: boolean; unread_count: number }>('notification-unread-count', { signal })
  return Number(response.unread_count) || 0
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await api('mark-notification-read', { method: 'PATCH', body: { notification_id: notificationId } })
}

export async function markAllNotificationsRead(): Promise<void> {
  await api('mark-notification-read', { method: 'PATCH', body: { all: true } })
}
