import { beforeEach, describe, expect, it } from 'vitest'
import {
  decrementUnread,
  readUnreadCount,
  resetUnreadStore,
  setUnreadCount,
  subscribeUnread,
} from './unread-store'

describe('unread store', () => {
  beforeEach(() => {
    resetUnreadStore()
  })

  it('floors at zero', () => {
    setUnreadCount(1)
    decrementUnread()
    decrementUnread()
    // A negative badge is the failure this guards: marking a row read while a
    // refresh is in flight can decrement twice for the same notification.
    expect(readUnreadCount()).toBe(0)
  })

  it('rejects a negative or fractional server value', () => {
    setUnreadCount(-5)
    expect(readUnreadCount()).toBe(0)
    setUnreadCount(3.7)
    expect(readUnreadCount()).toBe(3)
  })

  it('notifies subscribers on change and stays silent on a no-op write', () => {
    let calls = 0
    const unsubscribe = subscribeUnread(() => {
      calls += 1
    })

    setUnreadCount(4)
    expect(calls).toBe(1)

    // useSyncExternalStore re-renders on every emit, so an unchanged value must
    // not emit — the per-navigation refresh would otherwise re-render the whole
    // sidebar on every screen change.
    setUnreadCount(4)
    expect(calls).toBe(1)

    unsubscribe()
    setUnreadCount(9)
    expect(calls).toBe(1)
    expect(readUnreadCount()).toBe(9)
  })
})
