import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ToastContext, type ToastAction, type ToastApi } from '@/lib/toast-context'

/**
 * Renders the toasts. The contract and the `useToast` hook live in
 * lib/toast-context.ts; this file is only the surface.
 *
 * Error toasts never auto-dismiss — the user may still want the retry.
 * Success toasts do — there is no action to offer, so lingering is just
 * something else to dismiss.
 */

const AUTO_DISMISS_MS = 3200

interface Toast {
  id: number
  message: string
  kind: 'error' | 'success'
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
    const toast: Toast = { id, message, kind: 'error', action }
    // Newest first, and capped: a burst of failures should not build a wall.
    setToasts((current) => [toast, ...current].slice(0, 3))
  }, [])

  const succeed = useCallback(
    (message: string) => {
      const id = nextId.current++
      const toast: Toast = { id, message, kind: 'success' }
      setToasts((current) => [toast, ...current].slice(0, 3))
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(() => ({ fail, succeed }), [fail, succeed])

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
          {toasts.map((toast) => {
            // Full literal class strings per tone — Tailwind's build-time
            // scanner greps this file's raw text for whole class tokens, so
            // `` `border-${tone}` `` would never be generated: the token
            // "border-error" has to appear in the source verbatim.
            const styles =
              toast.kind === 'error'
                ? {
                    box: 'border-error bg-error-bg',
                    icon: 'text-error',
                    text: 'text-error',
                    action: 'text-error underline decoration-error/40 hover:decoration-error',
                    dismiss: 'text-error/70 hover:text-error',
                  }
                : {
                    box: 'border-success bg-success-bg',
                    icon: 'text-success',
                    text: 'text-success',
                    action: 'text-success underline decoration-success/40 hover:decoration-success',
                    dismiss: 'text-success/70 hover:text-success',
                  }
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-3 py-2 shadow-sm ${styles.box}`}
              >
                <span aria-hidden="true" className={`mt-px shrink-0 text-sm ${styles.icon}`}>
                  {toast.kind === 'error' ? '⚠' : '✓'}
                </span>
                <p className={`min-w-0 flex-1 text-sm ${styles.text}`}>{toast.message}</p>

                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.run()
                      dismiss(toast.id)
                    }}
                    className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-medium underline-offset-2 transition-colors duration-(--duration-fast) ease-out ${styles.action}`}
                  >
                    {toast.action.label}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="×"
                  className={`shrink-0 rounded px-1 text-sm transition-colors duration-(--duration-fast) ease-out ${styles.dismiss}`}
                >
                  ×
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
