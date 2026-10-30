import { useCallback, useEffect, useRef, useState } from 'react'
import { resourceCache } from '@/lib/resource-cache'

/** Long enough that going back to a list is instant, short enough that a
 *  second agent's change shows up without a reload. */
const DEFAULT_STALE_MS = 30_000

/** The slice of `document` the visibility refresh needs, so a test can fake it. */
export type VisibilitySource = Pick<
  Document,
  'addEventListener' | 'removeEventListener' | 'visibilityState'
>

/**
 * Calls `reload` when the tab becomes visible again and `isStale()` says the
 * data on screen is old. Returns the cleanup.
 */
export function reloadWhenVisible(
  source: VisibilitySource,
  isStale: () => boolean,
  reload: () => void,
): () => void {
  const onChange = () => {
    if (source.visibilityState === 'visible' && isStale()) reload()
  }
  source.addEventListener('visibilitychange', onChange)
  return () => source.removeEventListener('visibilitychange', onChange)
}

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string }

/**
 * Fetch-on-mount with loading, error and refetch. Four screens need exactly
 * this, which is why it exists — not enough to justify a data-fetching library,
 * too much to retype four times.
 *
 * `deps` drives refetching, same contract as useEffect. Aborts in flight on
 * change or unmount so a slow filter cannot overwrite a newer one.
 *
 * Pass a `key` to opt into the cache: a fresh entry paints immediately and
 * revalidates behind it (stale-while-revalidate), so going back to a list you
 * looked at four seconds ago stops showing a skeleton.
 *
 * WITHOUT a key it neither reads nor writes the cache — byte for byte the
 * behaviour every one of the thirty-seven existing callers has today. Keys get
 * added one screen at a time, each with its own check; converting all of them
 * at once would turn a single caching mistake into thirty-seven regressions.
 *
 * A cached screen MUST invalidate on write, or the agent publishes a listing
 * and does not see it. That is not a detail — it is the failure that makes a
 * cache worse than no cache.
 */
export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: { key?: string; staleMs?: number } = {},
): ResourceState<T> & { reload: () => void; revalidate: () => void } {
  const { key, staleMs = DEFAULT_STALE_MS } = options

  // Read synchronously in the initialiser, not in an effect: one render later
  // and the skeleton has already flashed, which is the whole thing this avoids.
  const [state, setState] = useState<ResourceState<T>>(() =>
    key !== undefined && resourceCache.has(key, Date.now(), staleMs)
      ? { status: 'ready', data: resourceCache.get<T>(key, Date.now(), staleMs) as T }
      : { status: 'loading' },
  )
  const [nonce, setNonce] = useState(0)
  const loadedAt = useRef(Date.now())

  const reload = useCallback(() => {
    if (key !== undefined) resourceCache.invalidate(key)
    setState({ status: 'loading' })
    setNonce((n) => n + 1)
  }, [key])

  // The visibility refresh: same fetch, but behind what is on screen — no
  // skeleton, no cache invalidation, and a failure (a laptop waking with no
  // network yet) keeps the data the agent was reading.
  const silent = useRef(false)
  const revalidate = useCallback(() => {
    silent.current = true
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const background = silent.current
    silent.current = false

    fetcher(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        loadedAt.current = Date.now()
        if (key !== undefined) resourceCache.set(key, data, loadedAt.current)
        setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        // An abort is a superseded request, not a failure to report.
        if (controller.signal.aborted) return
        // A background revalidation that fails leaves the cached data on
        // screen: replacing something readable with an error message, because
        // a refresh the agent never asked for failed, is a downgrade.
        if (key !== undefined && resourceCache.has(key, Date.now(), staleMs)) return
        const failed: ResourceState<T> = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Error',
        }
        setState((current) => (background && current.status === 'ready' ? current : failed))
      })

    return () => {
      controller.abort()
    }
    // The fetcher closes over the deps the caller declares; including it here
    // would refetch on every render since callers pass an inline arrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, key])

  // A tab left open keeps its list until something remounts it; coming back
  // to it should not mean a second agent's change stays invisible. Keyed
  // callers only, like the cache.
  useEffect(() => {
    if (key === undefined) return undefined
    return reloadWhenVisible(
      document,
      () => Date.now() - loadedAt.current > staleMs,
      revalidate,
    )
  }, [key, staleMs, revalidate])

  return { ...state, reload, revalidate }
}
