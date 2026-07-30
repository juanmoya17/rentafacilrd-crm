import { createContext, useContext } from 'react'

/**
 * Failure surface for optimistic updates. Split from the provider so the
 * component file only exports components — same split as auth-context /
 * auth-provider.
 *
 * design.md's motion stance says "no success toasts": if the user can see the
 * row moved, saying so is noise. `succeed()` is a narrow, deliberate exception
 * to that rule for the Task 6 bulk bar — a batch can change rows and KPI
 * counts the agent is not currently looking at (off the visible page, or in
 * the KPI strip above the fold), so the outcome isn't otherwise visible the
 * way a single optimistic row update is. Unlike `fail`, it auto-dismisses —
 * there is nothing to retry.
 */

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastApi {
  /** Report a failure. Stays until dismissed — the user may still want the retry. */
  fail: (message: string, action?: ToastAction) => void
  /** Report a success whose effect is not already visible on screen. Auto-dismisses. */
  succeed: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (api === null) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
