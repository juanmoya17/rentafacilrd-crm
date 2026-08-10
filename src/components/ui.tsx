import { useEffect, useId, useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link } from 'react-router'
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
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  variant?: ButtonVariant
  type?: 'button' | 'submit'
  state?: ControlState
  onClick?: () => void
  disabled?: boolean
  className?: string
  /**
   * Required whenever the label is hidden at some breakpoint or the button is
   * icon-only. An icon has no accessible name of its own — `<LogOut />` is
   * `aria-hidden`, so without this the control announces as "button".
   */
  'aria-label'?: string
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
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      /* whitespace-nowrap is not cosmetic: a button label that wraps to two
         lines is the single most common mobile break, and it is a hard gate. */
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-(--duration-fast) ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_VARIANTS[variant]} ${stateRing} ${className}`}
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
  inputMode,
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
  /**
   * Numeric keypad without `type="number"`. The spinner would collide with
   * the right-edge glyph slot, and Chrome reports an empty `value` for text a
   * number input considers malformed — so a typo would clear the field
   * instead of failing validation with a message.
   */
  inputMode?: 'numeric' | 'decimal'
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
          inputMode={inputMode}
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

/**
 * A `Button` that is actually a link. Anything that navigates has to be an
 * `<a>` — middle-click, ⌘-click and "copy link address" are not behaviours a
 * button with an onClick can fake.
 */
export function LinkButton({
  to,
  children,
  variant = 'secondary',
}: {
  to: string
  children: ReactNode
  variant?: ButtonVariant
}) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-(--duration-fast) ease-out active:translate-y-px ${BUTTON_VARIANTS[variant]}`}
    >
      {children}
    </Link>
  )
}

/* ---------------------------------------------------------------- textarea */

/**
 * Same label / message geometry as `Field`, for the two places a listing needs
 * real prose: the description and the SEO blurb. `rows` rather than autogrow —
 * a box that resizes while you type moves the buttons under your cursor.
 */
export function TextArea({
  id,
  label,
  value,
  onChange,
  rows = 5,
  state = 'idle',
  disabled,
  helper,
  error,
  required,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  state?: ControlState
  disabled?: boolean
  helper?: string
  error?: string
  required?: boolean
  placeholder?: string
}) {
  const c = resolveControl({ id, state, disabled, helper, error })

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={c.invalid || undefined}
        aria-describedby={c.describedBy}
        className={`mt-1 w-full resize-y rounded-md border bg-surface-raised px-3 py-2 text-sm text-ink transition-colors duration-(--duration-fast) ease-(--ease-out) placeholder:text-muted focus:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-55 ${
          c.invalid ? 'border-error' : FIELD_BORDERS[c.tone]
        }`}
      />

      {(helper !== undefined || error !== undefined) && (
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

/* -------------------------------------------------------------- file field */

/**
 * A native file input, restyled but never replaced: the file picker cannot be
 * opened from script without a real `<input type="file">`, and its own button
 * is the only control a screen reader announces as one.
 *
 * `onChange` receives the picked files, never the event — callers store `File`
 * objects and the input's own `value` stays untouched (it is read-only in every
 * browser, so there is nothing to control).
 */
export function FileField({
  id,
  label,
  accept,
  multiple,
  files,
  onChange,
  helper,
  error,
  state = 'idle',
  disabled,
  required,
}: {
  id: string
  label: string
  /** Mirrors the server's `mimes:` rule — a hint to the picker, not a check. */
  accept: string
  multiple?: boolean
  /** What is currently selected, so the list survives a step change. */
  files: File[]
  onChange: (files: File[]) => void
  helper?: string
  error?: string
  state?: ControlState
  disabled?: boolean
  required?: boolean
}) {
  const c = resolveControl({ id, state, disabled, helper, error })

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      <input
        id={id}
        name={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required && files.length === 0}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const picked = Array.from(event.target.files ?? [])
          // Appending would make re-picking the same file a duplicate, and
          // there is no way to deselect one from the native control.
          onChange(multiple === true ? picked : picked.slice(0, 1))
        }}
        aria-invalid={c.invalid || undefined}
        aria-describedby={c.describedBy}
        className={`mt-1 block w-full cursor-pointer rounded-md border bg-surface-raised text-sm text-ink-2 transition-colors duration-(--duration-fast) ease-(--ease-out) file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-rule file:bg-surface-sunken file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-2 disabled:cursor-not-allowed disabled:opacity-55 ${
          c.invalid ? 'border-error' : FIELD_BORDERS[c.tone]
        }`}
      />

      {files.length > 0 && (
        <ul className="mt-1.5 grid gap-0.5">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="truncate font-mono text-xs text-muted">
              {file.name}
            </li>
          ))}
        </ul>
      )}

      {(helper !== undefined || error !== undefined) && (
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

/* ------------------------------------------------------------------ select */

export interface SelectOption {
  value: string
  label: string
}

/**
 * A plain `<select>`. Native on purpose: it brings its own keyboard support,
 * type-ahead and a mobile picker that a listbox rebuilt in divs would owe a
 * few hundred lines to approximate.
 *
 * Same geometry as `Field` — one label line, one reserved message line — so a
 * form mixing the two does not step.
 */
export function Select({
  id,
  label,
  value,
  onChange,
  options,
  helper,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  helper?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      <select
        id={id}
        name={id}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        aria-describedby={helper === undefined ? undefined : `${id}-msg`}
        className="mt-1 min-h-9 w-full rounded-md border border-rule-2 bg-surface-raised px-3 py-1.5 text-sm text-ink transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken focus:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-55"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {helper !== undefined && (
        <p id={`${id}-msg`} className="mt-1 min-h-[1lh] text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- modal */

/**
 * Native `<dialog>` opened with showModal(), which is what buys the focus
 * trap, the inert background, Escape-to-close and the top-layer stacking —
 * none of which a div-with-a-backdrop gets without a few hundred lines that
 * are wrong in at least one browser.
 *
 * Mounted only while open (the caller conditionally renders it), so there is
 * no open/closed prop to keep in sync with the element's own state: opening
 * is mount, closing is the native `close` event calling back.
 */
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
  footer,
}: {
  title: string
  /** Accessible name for the × — the glyph has none of its own. */
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = ref.current
    element?.showModal()

    // close() on unmount, not just on the × — it is what returns focus to the
    // control that opened the dialog. A caller that dismisses by unmounting
    // (every Cancel button here) would otherwise drop focus to <body>.
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      /* m-auto because preflight zeroes the UA margin that centres a modal
         dialog. max-h + overflow so a long unit list scrolls inside the
         dialog rather than off the viewport. */
      className="m-auto max-h-[85dvh] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-lg border border-rule bg-surface-raised p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <h2 id={titleId} className="text-sm font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={closeLabel}
          className="-mr-1 shrink-0 rounded px-1.5 text-base text-muted transition-colors duration-(--duration-fast) ease-out hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  )
}

/* ------------------------------------------------------------------ static */

const BADGE_TONES = {
  neutral: 'bg-surface-sunken text-ink-2',
  brand: 'bg-brand-50 text-brand-700',
  sell: 'bg-sell-bg text-sell-ink',
  rent: 'bg-rent-bg text-rent-ink',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
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
    hot: 'bg-band-hot',
    warm: 'bg-band-warm',
    mild: 'bg-band-mild',
    cold: 'bg-band-cold',
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
