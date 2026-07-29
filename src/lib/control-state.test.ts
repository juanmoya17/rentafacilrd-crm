import { describe, expect, it } from 'vitest'
import { resolveControl } from '@/lib/control-state'

describe('resolveControl', () => {
  it('shows the helper and points aria-describedby at it', () => {
    const c = resolveControl({ id: 'email', helper: 'Lo usa para entrar' })
    expect(c).toMatchObject({
      tone: 'idle',
      message: 'Lo usa para entrar',
      messageIsError: false,
      invalid: false,
      busy: false,
      describedBy: 'email-msg',
    })
  })

  it('lets the error replace the helper rather than stack under it', () => {
    const c = resolveControl({
      id: 'email',
      state: 'error',
      helper: 'Lo usa para entrar',
      error: 'Ese correo no existe',
    })
    expect(c.message).toBe('Ese correo no existe')
    expect(c.messageIsError).toBe(true)
    expect(c.invalid).toBe(true)
  })

  it('never announces a disabled field as invalid', () => {
    // A screen reader offering "fix this" on a field the user cannot reach is
    // worse than silence, so disabled outranks every caller-set state.
    const c = resolveControl({
      id: 'email',
      state: 'error',
      disabled: true,
      helper: 'Lo usa para entrar',
      error: 'Ese correo no existe',
    })
    expect(c.tone).toBe('disabled')
    expect(c.invalid).toBe(false)
    expect(c.messageIsError).toBe(false)
    expect(c.message).toBe('Lo usa para entrar')
  })

  it('omits aria-describedby when there is no message to describe', () => {
    // Pointing at an empty <p> makes some screen readers announce nothing at
    // all for the field, which is worse than having no description.
    const c = resolveControl({ id: 'email' })
    expect(c.describedBy).toBeUndefined()
    expect(c.message).toBeUndefined()
  })

  it('still flags invalid when the error state carries no message', () => {
    // Form-level errors live in one alert; the field only borrows the border
    // and the aria flag.
    const c = resolveControl({ id: 'email', state: 'error' })
    expect(c.invalid).toBe(true)
    expect(c.messageIsError).toBe(false)
  })

  it('marks loading busy without marking it invalid', () => {
    const c = resolveControl({ id: 'email', state: 'loading' })
    expect(c).toMatchObject({ tone: 'loading', busy: true, invalid: false })
  })

  it('treats success as a quiet, valid state', () => {
    const c = resolveControl({ id: 'email', state: 'success' })
    expect(c).toMatchObject({ tone: 'success', invalid: false, busy: false })
  })
})
