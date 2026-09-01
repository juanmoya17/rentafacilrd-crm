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

type Tone = 'error' | 'neutral'

interface Toast {
  id: number
  message: string
  tone: Tone
  action?: ToastAction
}

/** Border and fill per tone; the text and controls follow in the markup. */
const TONE: Record<Tone, { shell: string; text: string; action: string; close: string }> = {
  error: {
    shell: 'border-error bg-error-bg',
    text: 'text-error',
    action: 'text-error decoration-error/40 hover:decoration-error',
    close: 'text-error/70 hover:text-error',
  },
  neutral: {
    shell: 'border-rule-2 bg-surface-raised',
    text: 'text-ink-2',
    action: 'text-brand-700 decoration-brand-700/40 hover:decoration-brand-700',
    close: 'text-muted hover:text-ink',
  },
}

/** Long enough to read six words and reach Undo, short enough to get out of
 *  the way before the next tap. */
const NEUTRAL_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Tone, action?: ToastAction) => {
      const id = nextId.current++
      // Newest first, and capped: a burst of failures should not build a wall.
      setToasts((current) => [{ id, message, tone, action }, ...current].slice(0, 3))

      // Errors never expire — the user may still want the retry. See ToastApi.
      if (tone === 'neutral') setTimeout(() => dismiss(id), NEUTRAL_MS)
    },
    [dismiss],
  )

  const fail = useCallback(
    (message: string, action?: ToastAction) => push(message, 'error', action),
    [push],
  )
  const notify = useCallback(
    (message: string, action?: ToastAction) => push(message, 'neutral', action),
    [push],
  )

  const api = useMemo<ToastApi>(() => ({ fail, notify }), [fail, notify])

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Fixed, so a new toast never pushes page content around. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        /* bottom-16 below lg: the mobile navigation bar owns that strip, and a
           failure toast tucked under it takes its Retry button with it. */
        className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col-reverse items-center gap-2 p-4 sm:items-end lg:bottom-0"
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
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-3 py-2 shadow-sm ${TONE[toast.tone].shell}`}
            >
              {toast.tone === 'error' && (
                <span aria-hidden="true" className="mt-px shrink-0 text-sm text-error">
                  ⚠
                </span>
              )}
              <p className={`min-w-0 flex-1 text-sm ${TONE[toast.tone].text}`}>{toast.message}</p>

              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.run()
                    dismiss(toast.id)
                  }}
                  className={`min-h-(--control-h) shrink-0 rounded px-1.5 text-sm font-medium underline underline-offset-2 transition-colors duration-(--duration-fast) ease-out ${TONE[toast.tone].action}`}
                >
                  {toast.action.label}
                </button>
              )}

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="×"
                className={`min-h-(--control-h) shrink-0 rounded px-1 text-sm transition-colors duration-(--duration-fast) ease-out ${TONE[toast.tone].close}`}
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
