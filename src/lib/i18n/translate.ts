import type { TranslationKey } from './es'
import type { Translate } from './context'

/**
 * Pure translate factory — kept out of the provider so the interpolation and
 * plural rules can be tested without rendering React.
 */
export function createTranslate(
  intlLocale: string,
  dictionary: Record<TranslationKey, string>,
): Translate {
  const plurals = new Intl.PluralRules(intlLocale)

  return (key, vars) => {
    let template = dictionary[key]

    // When a `count` is passed, prefer a `<key>_one` variant if the locale's
    // plural category calls for it. The base key stays the "other" form, so
    // only genuinely irregular strings need a second entry.
    const count = vars?.count
    if (typeof count === 'number') {
      const variant = `${key}_${plurals.select(count)}` as TranslationKey
      if (variant in dictionary) template = dictionary[variant]
    }

    if (vars === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    )
  }
}
