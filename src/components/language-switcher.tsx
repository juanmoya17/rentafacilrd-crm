import { useI18n, LOCALES, isLocale } from '@/lib/i18n/context'

/**
 * Native <select>: two options need no combobox widget, and this one is
 * keyboard- and screen-reader-correct for free.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <>
      <label htmlFor="locale" className="sr-only">
        {t('language.label')}
      </label>
      <select
        id="locale"
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value)
        }}
        className={`rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${className}`}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(`language.${option}`)}
          </option>
        ))}
      </select>
    </>
  )
}
