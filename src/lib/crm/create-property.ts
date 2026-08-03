/**
 * Creating a listing from the CRM — `POST /api/post_property`.
 *
 * This is the SAME endpoint the Flutter app and the website post to, not a CRM
 * one: there is no `crm/properties` write route, and inventing a second way to
 * create a listing would give the product two sets of rules to keep in sync.
 * So the payload here mirrors ApiController::post_property field for field,
 * including its bracket-array key format, which is the part a JSON body cannot
 * express and the reason this goes out as multipart.
 *
 * What the server decides and the client must never send: `added_by`,
 * `post_type`, `status`, and `request_status` — a listing is auto-approved only
 * when the `auto_approve` setting is on AND the poster is verified. Everyone
 * reaching this screen is a verified agent (the CRM is behind `verified.agent`),
 * so in practice that means published immediately when the setting allows it.
 */

import { api } from '@/lib/api'

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

/** `0` sell, `1` rent — the wire values, not labels. Rent is what makes
 *  `rentduration` required, both here and in the server validator. */
export type Operation = '0' | '1'

export const CONDITIONS = ['a_estrenar', 'en_construccion', 'de_reventa'] as const
export type Condition = (typeof CONDITIONS)[number]

/** The four the app's dropdown offers. Sent verbatim — the column is a string. */
export const RENT_DURATIONS = ['Daily', 'Monthly', 'Quarterly', 'Yearly'] as const
export type RentDuration = (typeof RENT_DURATIONS)[number]

/**
 * Every text field of the form, as strings. Strings all the way to the payload
 * for the same reason the typology editor does it: an emptied price has to stay
 * distinguishable from a zero, and `Number('')` is 0.
 */
export interface PropertyForm {
  category_id: string
  property_type: Operation
  rentduration: string
  title: string
  slug_id: string
  description: string
  price: string
  condition: '' | Condition
  area: string
  land_area: string
  country: string
  state: string
  city: string
  address: string
  client_address: string
  latitude: string
  longitude: string
  video_link: string
  meta_title: string
  meta_description: string
  meta_keywords: string
}

export interface PropertyMedia {
  title_image: File | null
  gallery_images: File[]
  three_d_image: File | null
  documents: File[]
  meta_image: File | null
}

/**
 * parameter_id -> value. A `File` for a `file` parameter, an array for a
 * `checkbox` one (joined with commas on the wire, which is what the website
 * sends and what `assign_parameters.value` stores).
 */
export type ParameterValues = Record<number, string | string[] | File>

/** facility_id -> distance in km. */
export type FacilityDistances = Record<number, string>

/** language_id -> the listing copy in that language. */
export type TranslationValues = Record<number, { title: string; description: string }>

export const EMPTY_PROPERTY_FORM: PropertyForm = {
  category_id: '',
  property_type: '0',
  rentduration: 'Monthly',
  title: '',
  slug_id: '',
  description: '',
  price: '',
  condition: '',
  area: '',
  land_area: '',
  country: '',
  state: '',
  city: '',
  address: '',
  client_address: '',
  latitude: '',
  longitude: '',
  video_link: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
}

export const EMPTY_PROPERTY_MEDIA: PropertyMedia = {
  title_image: null,
  gallery_images: [],
  three_d_image: null,
  documents: [],
  meta_image: null,
}

/* ------------------------------------------------------------- validation */

/** Laravel's `max:` counts kilobytes, so 3000 is ~2.93 MiB, not 3 MB. */
const IMAGE_MAX_BYTES = 3000 * 1024
const DOCUMENT_MAX_BYTES = 5120 * 1024

const TITLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
/** three_d_image also takes gif — the title image does not. */
const THREE_D_TYPES = [...TITLE_IMAGE_TYPES, 'image/gif']
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt']

/**
 * The server's YouTube rule, character for character (post_property's
 * `video_link` closure). Anything it rejects it re-checks with get_headers and
 * then fails anyway, so a link this regex refuses is a link the server refuses.
 */
const YOUTUBE =
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|shorts\/)?([a-zA-Z0-9_-]{11})([/?&=\w-]*)?$/

const DECIMAL = /^\d+(\.\d+)?$/

export type PropertyField =
  | keyof PropertyForm
  | 'title_image'
  | 'three_d_image'
  | 'gallery_images'
  | 'documents'
  | `param:${number}`

/** Which wizard step owns each field, so a failure can send the agent to it. */
export type PropertyStep =
  | 'category'
  | 'details'
  | 'parameters'
  | 'facilities'
  | 'location'
  | 'media'
  | 'seo'

export function stepOf(field: PropertyField): PropertyStep {
  if (field.startsWith('param:')) return 'parameters'

  switch (field) {
    case 'category_id':
    case 'property_type':
    case 'rentduration':
      return 'category'
    case 'country':
    case 'state':
    case 'city':
    case 'address':
    case 'client_address':
    case 'latitude':
    case 'longitude':
      return 'location'
    case 'title_image':
    case 'gallery_images':
    case 'three_d_image':
    case 'documents':
    case 'video_link':
      return 'media'
    case 'meta_title':
    case 'meta_description':
    case 'meta_keywords':
      return 'seo'
    default:
      return 'details'
  }
}

function extensionOf(file: File): string {
  const parts = file.name.split('.')

  return parts.length < 2 ? '' : (parts.pop() ?? '').toLowerCase()
}

/**
 * Mirrors post_property's validator plus the two tier gates it applies after
 * it. Convenience, not the boundary — the server runs all of this again — but
 * without it the agent loses a full multi-megabyte upload to a rule the form
 * could have named before the round trip.
 *
 * Returns the first offending field, in wizard order, or null.
 */
export function validateProperty(
  form: PropertyForm,
  media: PropertyMedia,
  parameters: ParameterValues,
  required: { id: number; is_required: number }[],
  /** From check-package-limit. Null = unlimited or not resolved; never treat as 0. */
  galleryLimit: number | null,
  /** False hides 3D + video; the server answers `media_rich_locked` for either. */
  mediaRich: boolean,
): PropertyField | null {
  if (form.category_id === '') return 'category_id'
  if (form.property_type === '1' && form.rentduration.trim() === '') return 'rentduration'

  if (form.title.trim() === '') return 'title'
  if (form.description.trim() === '') return 'description'

  // `min:1` — not just numeric. A listing at 0 is a data-entry slip, and the
  // server refuses it after the upload has already been paid for.
  const price = form.price.trim()
  if (price === '' || !DECIMAL.test(price) || Number(price) < 1) return 'price'

  for (const field of ['area', 'land_area'] as const) {
    const raw = form[field].trim()
    if (raw !== '' && !DECIMAL.test(raw)) return field
  }

  for (const parameter of required) {
    if (parameter.is_required !== 1) continue
    const value = parameters[parameter.id]
    const filled =
      value instanceof File ||
      (Array.isArray(value) ? value.length > 0 : (value ?? '').toString().trim() !== '')
    if (!filled) return `param:${parameter.id}`
  }

  if (form.address.trim() === '') return 'address'
  // Both or neither is not enough here: the server requires both.
  if (form.latitude.trim() === '' || form.longitude.trim() === '') return 'latitude'

  if (media.title_image === null) return 'title_image'
  if (!TITLE_IMAGE_TYPES.includes(media.title_image.type)) return 'title_image'
  if (media.title_image.size > IMAGE_MAX_BYTES) return 'title_image'

  if (galleryLimit !== null && media.gallery_images.length > galleryLimit) return 'gallery_images'
  for (const image of media.gallery_images) {
    if (!TITLE_IMAGE_TYPES.includes(image.type) || image.size > IMAGE_MAX_BYTES) {
      return 'gallery_images'
    }
  }

  if (media.three_d_image !== null) {
    if (!mediaRich) return 'three_d_image'
    if (!THREE_D_TYPES.includes(media.three_d_image.type)) return 'three_d_image'
    if (media.three_d_image.size > IMAGE_MAX_BYTES) return 'three_d_image'
  }

  for (const document of media.documents) {
    if (!DOCUMENT_EXTENSIONS.includes(extensionOf(document))) return 'documents'
    if (document.size > DOCUMENT_MAX_BYTES) return 'documents'
  }

  const video = form.video_link.trim()
  if (video !== '') {
    if (!mediaRich) return 'video_link'
    if (!YOUTUBE.test(video)) return 'video_link'
  }

  return null
}

/* ---------------------------------------------------------------- payload */

/**
 * The exact multipart body post_property parses.
 *
 * Empty optional fields are omitted rather than sent blank, matching the
 * website's builder: the handler defaults every one of them, and an empty
 * `condition` would fail its `in:` rule where an absent one passes `nullable`.
 *
 * The bracket indices must be sequential from 0. The handler reads a file
 * parameter back as `parameters.{index}.value`, so a gap would look up a slot
 * that does not exist and the value would be stored as the literal filename.
 */
export function propertyPayload(
  form: PropertyForm,
  media: PropertyMedia,
  parameters: ParameterValues,
  facilities: FacilityDistances,
  translations: TranslationValues,
): FormData {
  const body = new FormData()

  const put = (key: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed !== '') body.append(key, trimmed)
  }

  put('category_id', form.category_id)
  body.append('property_type', form.property_type)
  if (form.property_type === '1') put('rentduration', form.rentduration)

  put('title', form.title)
  put('slug_id', form.slug_id)
  put('description', form.description)
  put('price', form.price)
  put('condition', form.condition)
  put('area', form.area)
  put('land_area', form.land_area)

  put('country', form.country)
  put('state', form.state)
  put('city', form.city)
  put('address', form.address)
  put('client_address', form.client_address)
  put('latitude', form.latitude)
  put('longitude', form.longitude)

  put('video_link', form.video_link)
  put('meta_title', form.meta_title)
  put('meta_description', form.meta_description)
  put('meta_keywords', form.meta_keywords)

  if (media.title_image !== null) body.append('title_image', media.title_image)
  if (media.three_d_image !== null) body.append('three_d_image', media.three_d_image)
  if (media.meta_image !== null) body.append('meta_image', media.meta_image)
  media.gallery_images.forEach((file, index) => {
    body.append(`gallery_images[${index}]`, file)
  })
  media.documents.forEach((file, index) => {
    body.append(`documents[${index}]`, file)
  })

  let index = 0
  for (const [id, value] of Object.entries(parameters)) {
    // The handler skips any parameter with an empty value, so sending one only
    // burns an index that a later file parameter would then be misread by.
    const empty = Array.isArray(value)
      ? value.length === 0
      : !(value instanceof File) && value.trim() === ''
    if (empty) continue

    body.append(`parameters[${index}][parameter_id]`, id)
    body.append(
      `parameters[${index}][value]`,
      value instanceof File ? value : Array.isArray(value) ? value.join(',') : value,
    )
    index += 1
  }

  let facilityIndex = 0
  for (const [id, distance] of Object.entries(facilities)) {
    // PHP's empty('0') is true, so the handler drops a facility whose distance
    // is "0" exactly as if it were blank. The app sends '0.0' for the same
    // reason — its redesign dropped the distance input entirely.
    const value = distance.trim() === '' || Number(distance) === 0 ? '0.0' : distance.trim()
    body.append(`facilities[${facilityIndex}][facility_id]`, id)
    body.append(`facilities[${facilityIndex}][distance]`, value)
    facilityIndex += 1
  }

  let translationIndex = 0
  for (const [languageId, copy] of Object.entries(translations)) {
    for (const key of ['title', 'description'] as const) {
      const value = copy[key].trim()
      if (value === '') continue
      body.append(`translations[${translationIndex}][${key}][translation_id]`, '')
      body.append(`translations[${translationIndex}][${key}][language_id]`, languageId)
      body.append(`translations[${translationIndex}][${key}][value]`, value)
    }
    translationIndex += 1
  }

  return body
}

/** What the CRM needs back to route to the new listing. */
export interface CreatedProperty {
  id: number
  slug_id: string
  title: string
}

/**
 * The `property_list` refusal comes back as HTTP 200 with `error: true`, which
 * `api()` already turns into an ApiError — so an out-of-slots agent gets the
 * server's own "active_listing_limit_reached" wording, not a generic failure.
 */
export async function createProperty(body: FormData): Promise<CreatedProperty | null> {
  const response = await api<Envelope<CreatedProperty[]>>('post_property', {
    method: 'POST',
    body,
  })

  // get_property_details() answers with a collection even for one row.
  return response.data[0] ?? null
}
