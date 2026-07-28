import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setApiLocale } from '@/lib/api'
import { en } from './en'
import { es, type TranslationKey } from './es'
import {
  DEFAULT_LOCALE,
  I18nContext,
  isLocale,
  type Locale,
  type Translate,
} from './context'

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { es, en }
const STORAGE_KEY = 'rf-crm-locale'

/** Stored choice wins, then the browser, then Spanish. */
function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isLocale(stored)) return stored

  const browser = navigator.language.split('-')[0] ?? ''
  return isLocale(browser) ? browser : DEFAULT_LOCALE
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
]

// Seed the API client at module load. Effects run child-first, so waiting for
// I18nProvider's effect would let AuthProvider's boot probe leave without a
// Content-Language header.
const initialLocale = detectLocale()
setApiLocale(initialLocale)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // Keep the document and the API in step: Laravel localises responses off the
  // Content-Language header, and screen readers need <html lang> to be right.
  useEffect(() => {
    document.documentElement.lang = locale
    setApiLocale(locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const value = useMemo(() => {
    const dictionary = DICTIONARIES[locale]

    const t: Translate = (key, vars) => {
      const template = dictionary[key]
      if (vars === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      )
    }

    const formatNumber = (input: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(input)

    const formatCurrency = (input: number, currency = 'DOP') =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(input)

    const formatDate = (input: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(
        locale,
        options ?? { day: 'numeric', month: 'short', year: 'numeric' },
      ).format(new Date(input))

    const formatRelativeTime = (input: Date | string | number) => {
      const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
      const deltaMs = new Date(input).getTime() - Date.now()
      const absolute = Math.abs(deltaMs)

      for (const [unit, ms] of RELATIVE_UNITS) {
        if (absolute >= ms) return formatter.format(Math.round(deltaMs / ms), unit)
      }
      return formatter.format(0, 'second')
    }

    return { locale, setLocale, t, formatNumber, formatCurrency, formatDate, formatRelativeTime }
  }, [locale, setLocale])

  return <I18nContext value={value}>{children}</I18nContext>
}
