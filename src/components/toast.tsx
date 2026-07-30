import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ToastContext, type ToastAction, type ToastApi } from '@/lib/toast-context'

/**
 * Renders the failure toasts. The contract and the `useToast` hook live in
 * lib/toast-context.ts; this file is only the surface.
 *
 * Error toasts never auto-dismiss — the user may still want the retry.
 */

interface Toast {
  id: number
  message: string
  action?: ToastAction
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const fail = useCallback((message: string, action?: ToastAction) => {
    const id = nextId.current++
    // Newest first, and capped: a burst of failures should not build a wall.
    setToasts((current) => [{ id, message, action }, ...current].slice(0, 3))
  }, [])

  const api = useMemo<ToastApi>(() => ({ fail }), [fail])

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Fixed, so a new toast never pushes page content around. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col-reverse items-center gap-2 p-4 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-error bg-error-bg px-3 py-2 shadow-sm"
            >
              <span aria-hidden="true" className="mt-px shrink-0 text-sm text-error">
                ⚠
              </span>
              <p className="min-w-0 flex-1 text-sm text-error">{toast.message}</p>

              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.run()
                    dismiss(toast.id)
                  }}
                  className="shrink-0 rounded px-1.5 py-0.5 text-sm font-medium text-error underline decoration-error/40 underline-offset-2 transition-colors duration-(--duration-fast) ease-out hover:decoration-error"
                >
                  {toast.action.label}
                </button>
              )}

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="×"
                className="shrink-0 rounded px-1 text-sm text-error/70 transition-colors duration-(--duration-fast) ease-out hover:text-error"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
