import { createContext, useContext } from 'react'
import type { TranslationKey } from './es'

export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** RD is the market — Spanish wins when the browser says nothing useful. */
export const DEFAULT_LOCALE: Locale = 'es'

export function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value)
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
  /** Intl wrappers bound to the active locale — no formatting library needed. */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatCurrency: (value: number, currency?: string) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatRelativeTime: (value: Date | string | number) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (value === null) throw new Error('useI18n debe usarse dentro de <I18nProvider>.')
  return value
}

/** Shorthand for the common case. */
export function useT(): Translate {
  return useI18n().t
}
