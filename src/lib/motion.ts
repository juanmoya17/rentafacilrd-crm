import { useViewTransitionState } from 'react-router'
import { useReducedMotion } from 'motion/react'

/**
 * Shared motion vocabulary. Five primitives for the whole app, and no screen
 * uses more than three of them — see design.md § Motion.
 *
 * Everything here reads `useReducedMotion()` and returns a still variant when
 * the user has asked for less motion. That is checked in one place rather than
 * per call site, because the call site is where it gets forgotten.
 */

/** Rows/cards settle in on mount, capped so long lists finish quickly. */
export const REVEAL_CAP = 12
const STAGGER_MS = 22

/**
 * One-shot entrance for a list row.
 *
 * `once: true` is the whole point: a reveal that re-fires every time the row
 * scrolls back into view is the single most recognisable "AI dashboard" tell,
 * and it makes a long table feel like it is still loading.
 */
export function useRowReveal() {
  const still = useReducedMotion()

  return (index: number) => {
    if (still === true) return {}
    return {
      initial: { opacity: 0, y: 6 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-24px' },
      transition: {
        duration: 0.32,
        ease: [0.16, 1, 0.3, 1] as const,
        delay: Math.min(index, REVEAL_CAP) * (STAGGER_MS / 1000),
      },
    }
  }
}

/**
 * Shared-element morph between a list row and the record it opens.
 *
 * Returns the `view-transition-name` for the element, but only while a
 * navigation to/from `to` is actually running. Applying the name permanently
 * would put the same name on 50 rows at once, and a duplicated
 * view-transition-name aborts the entire transition — silently.
 */
export function useRecordMorph(to: string): { viewTransitionName?: string } {
  const active = useViewTransitionState(to)
  return active ? { viewTransitionName: 'record-title' } : {}
}

/** Hover/press lift for a card. Flat when reduced motion is requested. */
export function useLift() {
  const still = useReducedMotion()
  if (still === true) return {}
  return {
    whileHover: { y: -2 },
    whileTap: { y: 0 },
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  }
}
