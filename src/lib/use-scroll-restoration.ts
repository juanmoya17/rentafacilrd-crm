import { useEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { readScroll, restoreStep, saveScroll } from '@/lib/scroll-store'

/** How long to keep waiting for content to grow tall enough to restore into. */
const RESTORE_DEADLINE_MS = 1200

/**
 * Scroll restoration for an in-page scroll container.
 *
 * react-router's own `<ScrollRestoration>` reads and writes `window.scrollY`.
 * This app scrolls `<main>` instead — that is what lets a Register's table head
 * pin under the app bar — so window scroll is always 0 and the built-in
 * component has nothing to restore. Hence this.
 *
 * Behaviour:
 *   PUSH / REPLACE → top. A new record, or a changed filter, starts at the top;
 *                    holding offset 900 in a freshly filtered list is noise.
 *   POP            → restore, retrying as the route's data arrives.
 */
export function useScrollRestoration(ref: RefObject<HTMLElement | null>): void {
  const location = useLocation()
  const navigationType = useNavigationType()

  // Read in the scroll listener without making it a dependency, so the listener
  // is attached once for the life of the container rather than re-bound on
  // every navigation.
  const keyRef = useRef(location.key)
  keyRef.current = location.key

  // Continuously record where this entry is, so it is already saved by the time
  // the agent hits Back. Saving on unmount instead would mean reading scrollTop
  // from a node React is in the middle of detaching.
  useEffect(() => {
    const el = ref.current
    if (el === null) return

    let frame = 0
    const onScroll = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        saveScroll(keyRef.current, el.scrollTop)
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (el === null) return

    const target = navigationType === 'POP' ? readScroll(location.key) : 0

    if (target === undefined || target === 0) {
      el.scrollTop = 0
      return
    }

    const started = performance.now()
    let observer: ResizeObserver | null = null

    // Each attempt sets scrollTop and then reads it back: the browser clamps the
    // assignment to the current maximum, so the read tells us whether the
    // content is tall enough yet. If it is not, wait for it to grow.
    const attempt = (): void => {
      el.scrollTop = target
      const step = restoreStep({
        current: el.scrollTop,
        target,
        elapsedMs: performance.now() - started,
        deadlineMs: RESTORE_DEADLINE_MS,
      })
      if (step !== 'retry') observer?.disconnect()
    }

    attempt()

    if (el.scrollTop < target) {
      observer = new ResizeObserver(attempt)
      // Observing the content wrapper, not the scroll container: the container's
      // own box never changes size, only what is inside it does.
      const content = el.firstElementChild ?? el
      observer.observe(content)
    }

    return () => observer?.disconnect()
    // location.key is the identity of a history entry — the dependency that
    // actually marks "a navigation happened", including back to the same path.
  }, [ref, location.key, navigationType])
}
