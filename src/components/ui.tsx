import type { ChangeEvent, ReactNode } from 'react'
import { resolveControl, type ControlState, type ControlTone } from '@/lib/control-state'

/**
 * Small shared primitives. Kept in one file until any of them grows a real API.
 *
 * Colour, type and radius come from the tokens in index.css — see design.md.
 * No component here hardcodes a hex or a font-family. The eight-state
 * precedence and ARIA wiring live in lib/control-state.ts, which is where the
 * tests for them are.
 */

/* ----------------------------------------------------------------- spinner */

/** Inline progress. Under reduced-motion the global rule freezes it; the
 *  caller's label ("Guardando…") is what actually carries the state. */
function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5 shrink-0 [animation:rf-spin_700ms_linear_infinite]"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ button */

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'border border-rule-2 bg-surface-raised text-ink-2 hover:bg-surface-sunken active:bg-rule',
  ghost: 'text-ink-2 hover:bg-surface-sunken active:bg-rule',
} as const

export type ButtonVariant = keyof typeof BUTTON_VARIANTS

/**
 * All eight states: default · hover · focus-visible (global ring) · active ·
 * disabled · loading · error · success.
 *
 * `state` is one prop rather than three booleans so "loading and error at the
 * same time" cannot be expressed. Loading also blocks the click, so a
 * double-submit is impossible without the caller remembering to guard.
 */
export function Button({
  children,
  variant = 'secondary',
  type = 'button',
  state = 'idle',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode
  variant?: ButtonVariant
  type?: 'button' | 'submit'
  state?: ControlState
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const loading = state === 'loading'
  // Error and success tint the *border*, never the fill — a button that turns
  // red reads as a destructive button rather than a failed one.
  const stateRing =
    state === 'error'
      ? 'border border-error'
      : state === 'success'
        ? 'border border-success'
        : ''
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-(--duration-fast) ease-(--ease-out) disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_VARIANTS[variant]} ${stateRing} ${className}`}
    >
      {loading && <Spinner />}
      {state === 'success' && (
        <span aria-hidden="true" className="text-success">
          ✓
        </span>
      )}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- field */

const FIELD_BORDERS: Record<ControlTone, string> = {
  idle: 'border-rule-2',
  loading: 'border-rule-2',
  // Border colour flips only *alongside* the message and aria-invalid, never
  // as the sole signal.
  error: 'border-error',
  success: 'border-success',
  disabled: 'border-rule-2',
}

/**
 * Labelled text input with all eight states.
 *
 * Two rules hold the geometry still, because a control that resizes when you
 * touch it is the thing that makes a form feel untuned:
 *   · `border-width` is 1px in every state — colour moves, width never does.
 *   · the message slot always reserves one line, so validation cannot push
 *     the rest of the form down.
 */
export function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  state = 'idle',
  disabled,
  helper,
  error,
  invalid,
  required,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password' | 'tel' | 'search'
  state?: ControlState
  disabled?: boolean
  /** Persistent hint. Replaced by `error` when the field is in the error state. */
  helper?: string
  /** Field-level message. Shown only when `state` is `error`. */
  error?: string
  /** Mark invalid from a form-level error that has its own message elsewhere. */
  invalid?: boolean
  required?: boolean
  autoComplete?: string
  /** Shows the expected format, never an instruction — the label does that. */
  placeholder?: string
}) {
  const c = resolveControl({ id, state, disabled, helper, error })
  const showInvalid = c.invalid || invalid === true
  // Reserve the message line only when a message can ever appear here. A field
  // with neither prop cannot shift, so it should not pay for the reservation —
  // which is what keeps a bare login form from growing two dead lines.
  const canMessage = helper !== undefined || error !== undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      {/* The wrapper owns the right-edge glyph slot so the input's padding is
          constant — an appearing spinner never reflows the text. */}
      <div className="relative mt-1">
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={showInvalid || undefined}
          aria-describedby={c.describedBy}
          aria-busy={c.busy || undefined}
          className={`min-h-9 w-full rounded-md border bg-surface-raised px-3 py-1.5 pr-9 text-sm text-ink transition-colors duration-(--duration-fast) ease-(--ease-out) placeholder:text-muted hover:bg-surface-sunken focus:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-55 ${
            showInvalid ? 'border-error' : FIELD_BORDERS[c.tone]
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center">
          {c.tone === 'loading' && <Spinner />}
          {c.tone === 'error' && (
            <span aria-hidden="true" className="text-sm text-error">
              ⚠
            </span>
          )}
          {c.tone === 'success' && (
            <span aria-hidden="true" className="text-sm text-success">
              ✓
            </span>
          )}
        </span>
      </div>

      {/* One line stays reserved even while empty, so an error appearing later
          shifts nothing below it. */}
      {canMessage && (
        <p
          id={`${id}-msg`}
          className={`mt-1 min-h-[1lh] text-xs ${c.messageIsError ? 'text-error' : 'text-muted'}`}
        >
          {c.message}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ static */

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-ink-2',
  brand: 'bg-brand-50 text-brand-700',
  sell: 'bg-sell-bg text-sell-ink',
  rent: 'bg-rent-bg text-rent-ink',
  success: 'bg-success-bg text-success',
  // Warning still rides Tailwind's amber: it clears 4.5:1 already, and the
  // rent tokens are the wrong semantics to borrow. See design.md § Open edges.
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-error-bg text-error',
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
    <div role={role} className={`rounded-lg border border-rule bg-surface-raised ${className}`}>
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
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
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
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

/**
 * Lead score dot + number. Colour carries the D.1 band, the number the value —
 * and the number is what a colour-blind reader goes by, so the dot stays
 * `aria-hidden`.
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
    cold: 'bg-rule-2',
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink-2">
      <span className={`size-1.5 rounded-full ${colours[band]}`} aria-hidden="true" />
      {score}
    </span>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <Card className="grid place-items-center px-6 py-12" role="status">
      <p className="inline-flex items-center gap-2 text-sm text-muted">
        <Spinner />
        {label}
      </p>
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
      <p className="text-sm text-ink-2">{message}</p>
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
