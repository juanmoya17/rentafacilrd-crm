import { describe, expect, it } from 'vitest'
import { es } from './es'
import { en } from './en'
import { isLocale, LOCALES } from './context'
import { createTranslate } from './translate'

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

describe('createTranslate', () => {
  const tEs = createTranslate('es-DO', es)
  const tEn = createTranslate('en-US', en)

  it('interpolates named placeholders', () => {
    expect(tEs('dashboard.greeting', { name: 'Ana' })).toBe('Hola, Ana')
  })

  it('leaves an unknown placeholder untouched instead of printing undefined', () => {
    expect(tEs('dashboard.greeting', {})).toBe('Hola, {name}')
  })

  it('picks the singular form when count is 1', () => {
    expect(tEs('common.resultCount', { count: 1 })).toBe('1 resultado')
    expect(tEn('properties.inlineLeads', { count: 1 })).toBe('View 1 lead')
  })

  it('picks the plural form for every other count', () => {
    expect(tEs('common.resultCount', { count: 0 })).toBe('0 resultados')
    expect(tEs('common.resultCount', { count: 8 })).toBe('8 resultados')
    expect(tEn('properties.inlineLeads', { count: 3 })).toBe('View 3 leads')
  })

  it('falls back to the base key when no plural variant exists', () => {
    expect(tEs('projects.priceFrom', { price: 'RD$1', count: 1 })).toBe('Desde RD$1')
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
