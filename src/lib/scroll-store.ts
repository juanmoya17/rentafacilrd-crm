/**
 * Scroll positions per history entry, plus the retry decision that makes
 * restoring them actually work.
 *
 * Why this is not one line: `<main>` is the scroll container, and on a back
 * navigation its content is usually *shorter* than the saved offset at the
 * moment we try to restore — `useResource` has not answered yet, so the list is
 * a loading card. Assigning `scrollTop = 900` to a 400px-tall element silently
 * clamps to the maximum and the agent lands near the top anyway. So the restore
 * has to keep trying as content arrives, and know when to stop.
 */

/** Most recent entries win; the cap stops an all-day session growing forever. */
const MAX_ENTRIES = 50
const positions = new Map<string, number>()

export function saveScroll(key: string, top: number): void {
  // Re-insert so this key becomes the newest in iteration order.
  positions.delete(key)
  positions.set(key, top)
  if (positions.size > MAX_ENTRIES) {
    const oldest = positions.keys().next()
    if (!oldest.done) positions.delete(oldest.value)
  }
}

export function readScroll(key: string): number | undefined {
  return positions.get(key)
}

/** Test seam. */
export function clearScrollStore(): void {
  positions.clear()
}

export type RestoreStep = 'done' | 'retry' | 'give-up'

/**
 * Decides whether a restore attempt landed, should be retried once more content
 * arrives, or should be abandoned.
 *
 * `tolerance` exists because a container can legitimately settle one or two
 * pixels short of the saved offset (sub-pixel layout, a scrollbar appearing).
 * Retrying forever over a 1px gap would spin until the deadline on every single
 * back navigation.
 */
export function restoreStep({
  current,
  target,
  elapsedMs,
  deadlineMs,
  tolerance = 2,
}: {
  current: number
  target: number
  elapsedMs: number
  deadlineMs: number
  tolerance?: number
}): RestoreStep {
  if (current >= target - tolerance) return 'done'
  if (elapsedMs >= deadlineMs) return 'give-up'
  return 'retry'
}
