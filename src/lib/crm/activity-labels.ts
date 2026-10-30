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
  status: 'lifecycle',
  request_status: 'moderation',
}

/** `closed_at`, `due_at`, `start_date`…: the log stores them as ISO strings. */
const DATE_FIELD = /(_at|_date)$/

/**
 * Valor legible: etapa, origen, rol y estados usan las etiquetas que el CRM ya
 * muestra, las fechas ISO salen con el formato del lector; lo demás se imprime tal cual. Un vacío tiene que verse.
 */
export function activityValueLabel(
  field: string,
  value: ActivityValue,
  t: Translate,
  formatDate: (value: string) => string = String,
): string {
  if (value === null || value === '') return '—'

  if (DATE_FIELD.test(field) && typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return formatDate(value)
  }

  const prefix = VALUE_LABEL_PREFIX[field]
  if (prefix) {
    const label = t(`${prefix}.${String(value)}` as TranslationKey)
    return label ?? String(value)
  }

  return String(value)
}
