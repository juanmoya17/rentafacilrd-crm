import type { ReactNode } from 'react'

/** Small shared primitives. Kept in one file until any of them grows a real API. */

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  sell: 'bg-sell-bg text-sell',
  rent: 'bg-rent-bg text-rent',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
} as const

export type BadgeTone = keyof typeof BADGE_TONES

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function Card({
  children,
  className = '',
  role,
}: {
  children: ReactNode
  className?: string
  role?: string
}) {
  return (
    <div
      role={role}
      className={`rounded-lg border border-slate-200 bg-surface-raised ${className}`}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Never a blank screen — an empty state names the next action. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <Card className="grid place-items-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

export function Button({
  children,
  variant = 'secondary',
  type = 'button',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const tones = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${tones[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * Lead score dot + number. Colour carries the D.1 band, the number the value.
 *
 * Renders nothing without a band. Until D.1 computes a score the API sends no
 * band at all, and a bare number off an uncomputed field reads as a real
 * measurement — the same reason the API stopped sending a constant "cold".
 */
export function ScoreDot({
  score,
  band,
}: {
  score: number
  band?: 'hot' | 'warm' | 'mild' | 'cold' | null
}) {
  // Absent, not null: the API dropped the key entirely rather than sending a
  // null, so a `=== null` check never fires and the dot renders with an
  // "undefined" colour class. Catch both.
  if (band == null) return null

  const colours = {
    hot: 'bg-red-500',
    warm: 'bg-orange-400',
    mild: 'bg-amber-300',
    cold: 'bg-slate-300',
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
      <span className={`size-1.5 rounded-full ${colours[band]}`} aria-hidden="true" />
      {score}
    </span>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <Card className="grid place-items-center px-6 py-12" role="status">
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  )
}

/** Errors say what to do next, never just what broke. */
export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <Card className="grid place-items-center px-6 py-10 text-center" role="alert">
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-3">
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </Card>
  )
}

/** Placeholder marker so it is obvious which screens are not wired to the API yet. */
export function MockNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 rounded-md border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-800">
      {children}
    </p>
  )
}
