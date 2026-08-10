import { useSyncExternalStore } from 'react'
import { fetchUnreadCount } from '@/lib/crm/notifications'

/**
 * The bell badge's count, shared between the sidebar that renders it and the
 * notifications screen that changes it.
 *
 * A module store rather than a context because the two are on opposite sides
 * of the router's <Outlet/>: the sidebar mounts once for the whole session and
 * the screen comes and goes. Without a shared source, marking everything read
 * greys out the list while the sidebar keeps claiming four unread until the
 * next navigation remounts it — visibly broken, and the kind of staleness an
 * agent reads as "the tool lost my click".
 */
let count = 0
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function setUnreadCount(next: number): void {
  const clamped = Math.max(0, Math.trunc(next))
  if (clamped === count) return
  count = clamped
  emit()
}

/** One row went from unread to read. Floors at zero — see decrementUnread's test. */
export function decrementUnread(by = 1): void {
  setUnreadCount(count - by)
}

/** The snapshot the hook reads. Exported so the store is testable without a renderer. */
export function readUnreadCount(): number {
  return count
}

/** Subscribe outside React. Returns the unsubscriber. */
export function subscribeUnread(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribeUnread, readUnreadCount)
}

/** Fire-and-forget refresh. A failure leaves the last known count rather than zeroing the badge. */
export function refreshUnreadCount(signal?: AbortSignal): void {
  fetchUnreadCount(signal)
    .then(setUnreadCount)
    .catch(() => {
      /* keep the previous count: a network blip is not "you have no notifications" */
    })
}

/** Test seam. */
export function resetUnreadStore(): void {
  count = 0
  listeners.clear()
}
