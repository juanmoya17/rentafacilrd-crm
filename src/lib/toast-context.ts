import { createContext, useContext } from 'react'

/**
 * Surface for optimistic updates. Split from the provider so the component
 * file only exports components — same split as auth-context / auth-provider.
 *
 * There is deliberately no `succeed()`. If the user can see the row moved,
 * telling them it moved is noise; `fail` exists for the case where the UI
 * already showed a change and the server then refused, because that rollback
 * is otherwise invisible.
 *
 * `notify` is not that rule breaking, it is its edge. A stage changed by
 * tapping a row in a sheet has no gesture that explains itself the way a drag
 * does, and — more to the point — Undo needs somewhere to live. A confirmation
 * with nothing to act on would still be noise; this one carries the way back.
 */

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastApi {
  /** Report a failure. Stays until dismissed — the user may still want the retry. */
  fail: (message: string, action?: ToastAction) => void
  /**
   * Confirm something that worked, and offer the way back. Dismisses itself:
   * unlike a failure there is nothing here the user must act on, and one that
   * lingered would just be in the way of the next tap.
   */
  notify: (message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
