import { describe, expect, it } from 'vitest'
import { categoryOf } from './notifications'

/**
 * Mirrors the app's categoryFromStrings. If these two ever disagree, the same
 * notification carries one label on the phone and another in the CRM — which
 * is exactly the drift the shared vocabulary in App\Constants\
 * NotificationEventType exists to prevent.
 */
describe('categoryOf', () => {
  it('prefers event_type over type', () => {
    expect(categoryOf({ event_type: 'lead', type: '1' })).toBe('lead')
  })

  it('reads meeting subtypes as meetings from either field', () => {
    expect(categoryOf({ event_type: 'meeting_slot_selected' })).toBe('meeting')
    expect(categoryOf({ type: 'meeting_cancelled' })).toBe('meeting')
  })

  it('maps both verification events to one category', () => {
    expect(categoryOf({ event_type: 'agent_verification' })).toBe('verification')
    expect(categoryOf({ event_type: 'user_verification' })).toBe('verification')
  })

  it('falls back to type for legacy rows, including the numeric inquiry code', () => {
    expect(categoryOf({ event_type: null, type: '1' })).toBe('property_inquiry')
    expect(categoryOf({ event_type: '', type: 'chat' })).toBe('chat')
  })

  it('answers general for anything it does not recognise', () => {
    // A wrong label on a real notification is worse than an unspecific one.
    expect(categoryOf({ event_type: 'something_new', type: '2' })).toBe('general')
    expect(categoryOf({})).toBe('general')
    expect(categoryOf({ event_type: 'default' })).toBe('general')
  })
})
