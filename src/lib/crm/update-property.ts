/**
 * Editing a listing from the CRM — `POST /api/update_post_property`, the same
 * endpoint the app edits with. It authorizes the caller itself
 * (findEditableProperty), and editing a rejected listing is what sends it back
 * to review: "Corregir y reenviar" is just this, on a rejected row (RF-015).
 *
 * The prefill reads `get-added-properties?id=`, the app's "Mis propiedades".
 * Not the public `get_property`: that one filters publiclyVisible(), so it
 * answers nothing for exactly the rejected listings this screen exists to fix
 * (the same trap update-project.ts documents). Not the CRM list either: it
 * carries no parameters, facilities or translations.
 */

import { api } from '@/lib/api'
import type { AuthState } from '@/lib/auth-context'
import { createdRow, type Envelope } from './api'
import {
  CONDITIONS,
  EMPTY_PROPERTY_FORM,
  appendFacilities,
  type FacilityDistances,
  type Operation,
  type ParameterValues,
  type PropertyForm,
  type PropertyMedia,
  type TranslationValues,
} from './create-property'

/** Everything the wizard edits except files, which are never prefilled. */
export interface PropertyValues {
  form: PropertyForm
  parameters: ParameterValues
  facilities: FacilityDistances
  translations: TranslationValues
}

type TranslationKey = 'title' | 'description'

export interface PropertyEditSource {
  id: number
  /** Who the listing is assigned to — see canEditProperty. */
  addedBy: number
  /** The listing as saved: what the payload diffs against. */
  values: PropertyValues
  /** language_id -> key -> the saved translation's id, so an edit updates it
   *  in place. Without the id the server inserts a second row. */
  translationIds: Record<number, Partial<Record<TranslationKey, number>>>
  /** Photos already saved — the tier cap counts them with the new ones. */
  galleryCount: number
  /** Latest moderator note, for a rejected listing; null otherwise. */
  rejectReason: string | null
}

/** The slice of a get-added-properties row the edit screen reads. */
export interface AddedPropertyRow {
  id: number
  added_by: number
  category_id?: number | string | null
  /** The model accessor's label, not the wire 0..3. */
  propery_type?: 'sell' | 'rent' | 'sold' | 'rented' | null
  rentduration?: string | null
  title?: string | null
  slug_id?: string | null
  description?: string | null
  price?: number | string | null
  condition?: string | null
  area?: number | string | null
  land_area?: number | string | null
  country?: string | null
  state?: string | null
  city?: string | null
  address?: string | null
  client_address?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  video_link?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  gallery?: unknown[] | null
  parameters?: { id: number; type_of_parameter: string; value: unknown }[] | null
  assign_facilities?: { facility_id: number; distance: number | string | null }[] | null
  translations?: { id: number; language_id: number; key: string; value: string | null }[] | null
  /** `{}` when the listing is not rejected — the app endpoint's shape. */
  reject_reason?: { reason?: string | null } | null
}

/**
 * Editar es la regla de Compartir: el asesor sobre lo suyo, owner y admin sobre
 * cualquier anuncio de la agencia. El servidor la vuelve a aplicar
 * (findEditableProperty); esto solo evita ofrecer una edición que daría
 * "No Data Found" al guardar.
 */
export function canEditProperty(isAdmin: boolean, auth: AuthState, addedBy: number): boolean {
  return isAdmin || (auth.status === 'authenticated' && addedBy === auth.user.id)
}

/** RF0012 -> 12. Null for anything else, so the API is never asked. */
export function propertyIdOf(code: string): number | null {
  const match = /^RF(\d+)$/.exec(code)
  const id = match === null ? 0 : Number(match[1])

  return id > 0 ? id : null
}

const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

export function toPropertyEdit(row: AddedPropertyRow): PropertyEditSource {
  // A closed listing (sold/rented) edits as its operation. Unchanged, the
  // operation is never sent, so the closed state survives the save.
  const operation: Operation =
    row.propery_type === 'rent' || row.propery_type === 'rented' ? '1' : '0'
  const condition = text(row.condition)

  const form: PropertyForm = {
    ...EMPTY_PROPERTY_FORM,
    category_id: text(row.category_id),
    property_type: operation,
    rentduration: text(row.rentduration) || EMPTY_PROPERTY_FORM.rentduration,
    title: text(row.title),
    slug_id: text(row.slug_id),
    description: text(row.description),
    price: text(row.price),
    condition: (CONDITIONS as readonly string[]).includes(condition)
      ? (condition as PropertyForm['condition'])
      : '',
    area: text(row.area),
    land_area: text(row.land_area),
    country: text(row.country),
    state: text(row.state),
    city: text(row.city),
    address: text(row.address),
    client_address: text(row.client_address),
    latitude: text(row.latitude),
    longitude: text(row.longitude),
    video_link: text(row.video_link),
    meta_title: text(row.meta_title),
    meta_description: text(row.meta_description),
    meta_keywords: text(row.meta_keywords),
  }

  const parameters: ParameterValues = {}
  for (const parameter of row.parameters ?? []) {
    const value = parameter.value
    // A checkbox is stored comma-joined (or, from older clients, as JSON,
    // which the accessor has already decoded into an array).
    parameters[parameter.id] = Array.isArray(value)
      ? value.map(String)
      : parameter.type_of_parameter === 'checkbox'
        ? text(value).split(',').filter((entry) => entry !== '')
        : text(value)
  }

  const facilities: FacilityDistances = {}
  for (const facility of row.assign_facilities ?? []) {
    facilities[facility.facility_id] = text(facility.distance)
  }

  const translations: TranslationValues = {}
  const translationIds: PropertyEditSource['translationIds'] = {}
  for (const translation of row.translations ?? []) {
    if (translation.key !== 'title' && translation.key !== 'description') continue
    const key: TranslationKey = translation.key
    translations[translation.language_id] = {
      ...(translations[translation.language_id] ?? { title: '', description: '' }),
      [key]: text(translation.value),
    }
    translationIds[translation.language_id] = {
      ...translationIds[translation.language_id],
      [key]: translation.id,
    }
  }

  const reason = row.reject_reason?.reason

  return {
    id: row.id,
    addedBy: Number(row.added_by),
    values: { form, parameters, facilities, translations },
    translationIds,
    galleryCount: row.gallery?.length ?? 0,
    rejectReason: typeof reason === 'string' && reason.trim() !== '' ? reason : null,
  }
}

export async function fetchPropertyForEdit(
  id: number,
  signal?: AbortSignal,
): Promise<PropertyEditSource | null> {
  const response = await api<Envelope<AddedPropertyRow[] | null>>(
    `get-added-properties?id=${id}`,
    { signal },
  )
  // Scoped server-side to what the caller may see: someone else's listing is
  // simply not in the list.
  const row = response.data?.[0]

  return row === undefined ? null : toPropertyEdit(row)
}

/** Comparable form of a parameter value. Files always count as changed. */
const flat = (value: ParameterValues[number] | undefined): string =>
  value === undefined ? '' : value instanceof File ? '' : Array.isArray(value) ? value.join(',') : value

/**
 * The multipart body update_post_property parses: the id, and only what the
 * agent changed — except what the handler would otherwise get wrong:
 *
 * - `latitude`, `longitude`, `price`: its validator requires them on every
 *   edit, changed or not.
 * - `meta_title`, `meta_description`, `meta_keywords`: it writes
 *   `$request->x ?? null`, so leaving one out blanks it.
 * - `facilities`: it deletes the listing's facilities and re-adds what it
 *   receives, so the set goes whole every time.
 * - `rentduration` with a switch to rent: required_if property_type is 1.
 * - `slug_id` with a new title: otherwise the slug is rebuilt from it.
 *
 * A cleared field goes out empty rather than absent, so the handlers that
 * read it with has() (condition, area, land_area) clear the column.
 */
export function propertyUpdatePayload(
  source: PropertyEditSource,
  current: PropertyValues,
  media: PropertyMedia,
): FormData {
  const body = new FormData()
  const before = source.values.form
  const after = current.form

  body.append('action_type', '0')
  body.append('id', String(source.id))

  const ALWAYS: (keyof PropertyForm)[] = [
    'latitude',
    'longitude',
    'price',
    'meta_title',
    'meta_description',
    'meta_keywords',
  ]
  for (const key of Object.keys(after) as (keyof PropertyForm)[]) {
    const value = after[key].trim()
    if (ALWAYS.includes(key) || value !== before[key].trim()) body.append(key, value)
  }
  // A new title alone makes the handler rebuild the slug from it, which
  // moves the public URL of a published listing. Send the saved one.
  if (body.has('title') && !body.has('slug_id') && before.slug_id.trim() !== '') {
    body.append('slug_id', before.slug_id.trim())
  }
  if (after.property_type === '1' && body.has('property_type') && !body.has('rentduration')) {
    body.append('rentduration', after.rentduration.trim())
  }

  if (media.title_image !== null) body.append('title_image', media.title_image)
  if (media.three_d_image !== null) body.append('three_d_image', media.three_d_image)
  if (media.meta_image !== null) body.append('meta_image', media.meta_image)
  media.gallery_images.forEach((file, index) => {
    body.append(`gallery_images[${index}]`, file)
  })
  media.documents.forEach((file, index) => {
    body.append(`documents[${index}]`, file)
  })

  // Changed and removed parameters. A removed one goes out empty: the handler
  // upserts by parameter_id, so leaving it out would keep the old value.
  const ids = new Set([
    ...Object.keys(source.values.parameters),
    ...Object.keys(current.parameters),
  ])
  let index = 0
  for (const id of ids) {
    const was = source.values.parameters[Number(id)]
    const now = current.parameters[Number(id)]
    if (!(now instanceof File) && flat(now) === flat(was)) continue

    body.append(`parameters[${index}][parameter_id]`, id)
    body.append(`parameters[${index}][value]`, now instanceof File ? now : flat(now))
    index += 1
  }

  appendFacilities(body, current.facilities)

  let translationIndex = 0
  for (const [languageId, copy] of Object.entries(current.translations)) {
    const saved = source.values.translations[Number(languageId)]
    let sent = false
    for (const key of ['title', 'description'] as const) {
      const value = copy[key].trim()
      // The handler skips an empty value, so a translation cannot be cleared
      // from here — same as the app.
      if (value === '' || value === (saved?.[key] ?? '').trim()) continue
      const translationId = source.translationIds[Number(languageId)]?.[key]
      body.append(
        `translations[${translationIndex}][${key}][translation_id]`,
        translationId === undefined ? '' : String(translationId),
      )
      body.append(`translations[${translationIndex}][${key}][language_id]`, languageId)
      body.append(`translations[${translationIndex}][${key}][value]`, value)
      sent = true
    }
    if (sent) translationIndex += 1
  }

  return body
}

export async function updateProperty(body: FormData): Promise<void> {
  // The handler answers a listing the caller cannot edit with a *success*
  // envelope and no data ("No Data Found"). createdRow turns that into the
  // error it is, instead of navigating away as if it had saved.
  const response = await api<Envelope<unknown[] | null>>('update_post_property', {
    method: 'POST',
    body,
  })
  createdRow(response)
}
