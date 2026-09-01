import { describe, expect, it } from 'vitest'
import { prefersRedirect } from './google-flow'

/**
 * Which of the two Google flows a device gets. Firebase's own docs recommend
 * redirect on mobile: the popup needs a direct user gesture that any `await`
 * before it destroys, and Safari iOS blocks it outright often enough that
 * "nothing happened" is the normal failure.
 */
describe('prefersRedirect', () => {
  it('sends a phone through the redirect', () => {
    expect(prefersRedirect(390)).toBe(true)
  })

  it('leaves a desktop on the popup', () => {
    expect(prefersRedirect(1440)).toBe(false)
  })

  it('sends a narrow desktop window through the redirect too', () => {
    // Width, not pointer type: this is the case that actually breaks, and a
    // 1440px touchscreen laptop opens popups perfectly well.
    expect(prefersRedirect(600)).toBe(true)
  })

  it('splits at the tablet breakpoint, exclusive', () => {
    expect(prefersRedirect(767)).toBe(true)
    expect(prefersRedirect(768)).toBe(false)
  })
})
