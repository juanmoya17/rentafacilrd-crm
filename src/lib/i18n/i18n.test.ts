import { describe, expect, it } from 'vitest'
import { es } from './es'
import { en } from './en'
import { isLocale, LOCALES } from './context'

describe('dictionaries', () => {
  // TypeScript already fails the build on a missing key; this catches the
  // reverse — a stale English key left behind after Spanish dropped it.
  it('have exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('leave no value empty', () => {
    for (const [key, value] of Object.entries({ ...es, ...en })) {
      expect(value, `clave vacía: ${key}`).not.toBe('')
    }
  })

  it('keep interpolation placeholders in sync across locales', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort()

    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), `placeholders distintos en ${key}`).toEqual(
        placeholders(es[key]),
      )
    }
  })
})

describe('isLocale', () => {
  it('accepts every supported locale', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
  })

  it('rejects unknown values and null', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})
