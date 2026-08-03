/**
 * `POST /api/generate-description` — the same AI writer the app and the
 * website use (AiDescriptionController + GenerateDescriptionRequest).
 *
 * Gated on the `ai_description` package feature; a locked tier answers 200 with
 * `error: true`, which `api()` raises with the server's own wording.
 * Rate-limited to 20/min server-side.
 */

import { api } from '@/lib/api'
import type { CategoryParameter } from './reference'
import type { ParameterValues, PropertyForm } from './create-property'

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
}

/** Stricter than the listing's own images: 2 MB, and webp is allowed here. */
const AI_IMAGE_MAX_BYTES = 2048 * 1024
const AI_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
/** The server caps at four and logs the overflow — send four, not twenty. */
const AI_IMAGE_CAP = 4

/**
 * The request's own `withValidator` rule: enough text (a category plus a price
 * or a city) OR at least one photo. Mirrored so the button can explain what is
 * missing instead of the agent earning a 422.
 */
export function canGenerateDescription(
  form: PropertyForm,
  photos: File[],
): boolean {
  const hasText =
    form.category_id !== '' && (form.price.trim() !== '' || form.city.trim() !== '')

  return hasText || photos.length > 0
}

/**
 * Parameters travel keyed by LABEL, not id — the prompt reads them as prose
 * ("Habitaciones: 3"), so an id would be noise. Multi-selects additionally go
 * out as `amenities[]`, which is the field the generator treats as a feature
 * list rather than a spec line.
 */
export async function generateDescription(
  form: PropertyForm,
  parameters: ParameterValues,
  definitions: CategoryParameter[],
  categoryLabel: string,
  photos: File[],
): Promise<string> {
  const body = new FormData()

  const put = (key: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed !== '') body.append(key, trimmed)
  }

  put('category', categoryLabel)
  put('operation', form.property_type === '1' ? 'rent' : 'sell')
  put('price', form.price)
  put('city', form.city)
  put('state', form.state)
  put('area', form.area)
  put('title', form.title)

  let amenityIndex = 0
  for (const definition of definitions) {
    const value = parameters[definition.id]
    if (value === undefined || value instanceof File) continue

    const label = definition.translated_name ?? definition.name

    if (Array.isArray(value)) {
      for (const entry of value) {
        body.append(`amenities[${amenityIndex}]`, entry)
        amenityIndex += 1
      }
      continue
    }

    put(`parameters[${label}]`, value)
  }

  photos
    .filter((file) => AI_IMAGE_TYPES.includes(file.type) && file.size <= AI_IMAGE_MAX_BYTES)
    .slice(0, AI_IMAGE_CAP)
    .forEach((file, index) => {
      body.append(`images[${index}]`, file)
    })

  const response = await api<Envelope<{ description: string }>>('generate-description', {
    method: 'POST',
    body,
  })

  return response.data.description
}
