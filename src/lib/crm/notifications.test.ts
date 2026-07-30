import { describe, expect, it } from 'vitest'
import type { NotificationDefaults, NotificationPreference } from './notifications'
import { resolvePreference } from './notifications'

const defaults: NotificationDefaults = {
  lead_alerts: { push: true, email: true },
  listing_matches: { push: true, email: true },
  subscription: { push: true, email: true },
  reengagement: { push: true, email: true },
  meeting_updates: { push: false, email: true },
}

describe('resolvePreference', () => {
  it('falls through to the default when no explicit preference exists', () => {
    expect(resolvePreference(defaults, [], 'lead_alerts', 'push')).toBe(true)
    expect(resolvePreference(defaults, [], 'meeting_updates', 'push')).toBe(false)
  })

  it('an explicit preference beats the default when turning it off', () => {
    const preferences: NotificationPreference[] = [
      { event_type: 'lead_alerts', channel: 'push', enabled: false },
    ]
    expect(resolvePreference(defaults, preferences, 'lead_alerts', 'push')).toBe(false)
  })

  it('an explicit preference beats the default when turning it on', () => {
    const preferences: NotificationPreference[] = [
      { event_type: 'meeting_updates', channel: 'push', enabled: true },
    ]
    expect(resolvePreference(defaults, preferences, 'meeting_updates', 'push')).toBe(true)
  })

  it('leaves a different channel on the same event type unaffected', () => {
    const preferences: NotificationPreference[] = [
      { event_type: 'lead_alerts', channel: 'push', enabled: false },
    ]
    expect(resolvePreference(defaults, preferences, 'lead_alerts', 'email')).toBe(true)
  })

  it('leaves a different event type on the same channel unaffected', () => {
    const preferences: NotificationPreference[] = [
      { event_type: 'lead_alerts', channel: 'push', enabled: false },
    ]
    expect(resolvePreference(defaults, preferences, 'listing_matches', 'push')).toBe(true)
  })
})
