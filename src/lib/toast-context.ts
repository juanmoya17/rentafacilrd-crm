import { createContext, useContext } from 'react'

/**
 * Failure surface for optimistic updates. Split from the provider so the
 * component file only exports components — same split as auth-context /
 * auth-provider.
 *
 * There is deliberately no `succeed()`. If the user can see the row moved,
 * telling them it moved is noise; toasts exist for the case where the UI
 * already showed a change and the server then refused, because that rollback
 * is otherwise invisible.
 */

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastApi {
  /** Report a failure. Stays until dismissed — the user may still want the retry. */
  fail: (message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
