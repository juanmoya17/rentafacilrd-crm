import type { Translate } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/es'

type ActivityValue = string | number | boolean | null

/**
 * Nombre legible de un campo del historial. Sin etiqueta propia cae al
 * nombre con `_` como espacio: mejor eso que el identificador de la base.
 */
export function activityFieldLabel(field: string, t: Translate): string {
  const key = `agency.activity.field.${field}` as TranslationKey
  const label = t(key)

  // Sin entrada, el diccionario devuelve undefined (el tipo no lo refleja).
  return label ?? field.replaceAll('_', ' ')
}

/** Campos cuyo valor ya tiene etiquetas en el CRM: campo -> prefijo de clave. */
const VALUE_LABEL_PREFIX: Record<string, string> = {
  stage: 'stage',
  origin: 'origin',
  role: 'agency.role',
}

/**
 * Valor legible: etapa, origen y rol usan las etiquetas que el CRM ya
 * muestra; lo demás se imprime tal cual. Un vacío tiene que verse.
 */
export function activityValueLabel(field: string, value: ActivityValue, t: Translate): string {
  if (value === null || value === '') return '—'

  const prefix = VALUE_LABEL_PREFIX[field]
  if (prefix) {
    const label = t(`${prefix}.${String(value)}` as TranslationKey)
    return label ?? String(value)
  }

  return String(value)
}
