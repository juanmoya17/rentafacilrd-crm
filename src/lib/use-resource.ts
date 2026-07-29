import { useCallback, useEffect, useState } from 'react'

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
 */
export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): ResourceState<T> & { reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        // An abort is a superseded request, not a failure to report.
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Error',
        })
      })

    return () => {
      controller.abort()
    }
    // The fetcher closes over the deps the caller declares; including it here
    // would refetch on every render since callers pass an inline arrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload }
}
