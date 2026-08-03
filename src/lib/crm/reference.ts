/**
 * Reference data for the create forms.
 *
 * These four endpoints live OUTSIDE the /api/crm prefix — they are the same
 * ones the Flutter app and the website call, so the shapes here mirror
 * ApiController, not the CRM resources. None of them is behind
 * `verified.agent`; reaching them at all already means a CRM session.
 */

import { api } from '@/lib/api'

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

/** The seven `type_of_parameter` values the admin panel can produce. */
export type ParameterType =
  | 'textbox'
  | 'textarea'
  | 'number'
  | 'dropdown'
  | 'radiobutton'
  | 'checkbox'
  | 'file'

export interface ParameterOption {
  value: string
  /** Localised label. Absent when the option has no translation row. */
  translated?: string | null
}

export interface CategoryParameter {
  id: number
  name: string
  translated_name?: string | null
  type_of_parameter: ParameterType
  /** 1/0 out of MySQL, not a bool. */
  is_required: number
  /** Present only for dropdown / radiobutton / checkbox. */
  translated_option_value?: ParameterOption[] | null
}

/** `No`, in the spellings the panel's option editor actually produces. */
const NEGATIVES = ['no', 'not', 'false', '0']

/**
 * The "yes" value of a boolean parameter, or null if it is a real multi-select.
 *
 * This installation does not model amenities as one parameter with twenty
 * options. Each amenity is its own `checkbox` parameter whose options are
 * exactly `Si` / `No` — "Piscina", "Gimnasio", "Balcón" and eighteen more on a
 * house. Rendering each of those as a labelled Si/No pair produces twenty
 * fieldsets and no way to see at a glance what the property has; rendering
 * each as one tag is the same data in one line of chips.
 *
 * A single-option parameter ("Amueblado" ships with just `Si`) is a boolean
 * too. Anything with two non-negative options is a genuine choice and is left
 * alone.
 */
export function affirmativeOption(parameter: CategoryParameter): string | null {
  if (parameter.type_of_parameter !== 'checkbox') return null

  const options = parameter.translated_option_value ?? []
  if (options.length === 0 || options.length > 2) return null

  const positives = options.filter(
    (option) => !NEGATIVES.includes(option.value.trim().toLowerCase()),
  )
  // Two positives is a choice between two things, not a yes/no.
  if (positives.length !== 1) return null

  return positives[0]?.value ?? null
}

export interface Category {
  id: number
  category: string
  translated_name?: string | null
  image: string
  /** The category's own field set — what makes the parameters step dynamic. */
  parameter_types: CategoryParameter[]
}

export interface OutdoorFacility {
  id: number
  name: string
  translated_name?: string | null
  image: string
}

export interface Language {
  id: number
  code: string
  name: string
}

/**
 * get_categories defaults to `limit=10` and there are more categories than
 * that — without an explicit limit the picker silently loses the tail.
 */
export async function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  const body = await api<Envelope<Category[]>>('get_categories?limit=100', { signal })

  return body.data
}

export async function fetchFacilities(signal?: AbortSignal): Promise<OutdoorFacility[]> {
  const body = await api<Envelope<OutdoorFacility[]>>('get_facilities', { signal })

  return body.data
}

/**
 * The language list rides on `web-settings` — the same call the website reads
 * it from. There is no endpoint that returns it alone: `get_languages` takes a
 * code and answers with ONE language plus its whole translation file, and the
 * legacy `get_app_settings` carries no languages at all.
 *
 * `data` is `[]` when the settings table is empty, so this reads through an
 * optional key rather than indexing an object it assumes exists.
 */
export async function fetchLanguages(signal?: AbortSignal): Promise<Language[]> {
  const body = await api<Envelope<{ languages?: Language[] }>>('web-settings', { signal })

  return body.data.languages ?? []
}

/**
 * The tier gates post_property enforces server-side. Fetched up front so the
 * form can cap the gallery and hide the locked media fields instead of letting
 * the agent fill in twenty photos and a video for a 422 at the end.
 *
 * `limit` is only sent for the counted features (gallery_photos); null there
 * means unlimited or free-tier-default, and the caller must not treat it as 0.
 */
export interface PackageLimit {
  package_available: boolean
  feature_available: boolean
  limit_available: boolean
  limit?: number | null
}

export async function checkPackageLimit(
  type: 'property_list' | 'project_list' | 'gallery_photos' | 'media_rich' | 'ai_description',
  signal?: AbortSignal,
): Promise<PackageLimit> {
  const body = await api<Envelope<PackageLimit>>(`check-package-limit?type=${type}`, { signal })

  return body.data
}
