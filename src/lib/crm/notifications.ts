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

export async function setNotificationPreference(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<void> {
  await api('crm/notification-preferences', {
    method: 'PUT',
    body: { event_type: eventType, channel, enabled },
  })
}

export async function setPropertyOverride(
  propertyId: number,
  eventType: NotificationEventType,
  enabled: boolean,
): Promise<void> {
  await api('crm/notification-preferences/property', {
    method: 'PUT',
    body: { property_id: propertyId, event_type: eventType, enabled },
  })
}

/** Clears every stored deviation — preferences and property overrides alike. */
export async function resetNotificationPreferences(): Promise<void> {
  await api('crm/notification-preferences', { method: 'DELETE' })
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
