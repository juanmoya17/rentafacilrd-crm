/**
 * The four states a control can be *put into* by its caller. Hover, focus and
 * active are the browser's business (`:hover` / `:focus-visible` / `:active`);
 * disabled is a native attribute. Together those are the eight states every
 * interactive primitive in components/ui.tsx ships.
 */
export type ControlState = 'idle' | 'loading' | 'error' | 'success'

export type ControlTone = ControlState | 'disabled'

/**
 * Resolves a control's rendered state and its ARIA wiring in one place.
 *
 * The precedence matters and is the reason this is a function rather than a
 * ternary at each call site: a disabled field must not also announce itself as
 * invalid (a screen reader would offer a correction the user cannot make), and
 * an error message must *replace* the helper text rather than stack under it,
 * or validation shifts the page down by a line.
 */
export function resolveControl({
  id,
  state = 'idle',
  disabled = false,
  helper,
  error,
}: {
  id: string
  state?: ControlState
  disabled?: boolean
  helper?: string
  error?: string
}): {
  tone: ControlTone
  /** Message to render in the helper slot, if any. */
  message?: string
  /** Whether that message is the error one — drives its colour. */
  messageIsError: boolean
  invalid: boolean
  busy: boolean
  /** Value for aria-describedby; undefined when there is nothing to point at. */
  describedBy?: string
} {
  const tone: ControlTone = disabled ? 'disabled' : state
  // Only a genuinely-erroring, reachable control is invalid.
  const messageIsError = tone === 'error' && error !== undefined
  const message = messageIsError ? error : helper
  return {
    tone,
    message,
    messageIsError,
    invalid: tone === 'error',
    busy: tone === 'loading',
    describedBy: message === undefined ? undefined : `${id}-msg`,
  }
}
