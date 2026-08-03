/**
 * Creating a project from the CRM — `POST /api/post_project`.
 *
 * Same reasoning as create-property.ts: the CRM has no project write route of
 * its own (only typologies and units under `crm/projects/{id}`), so this posts
 * to the endpoint the app and the website already use.
 *
 * Deliberately NOT covered here: `plans[]`. The CRM has a richer typology
 * editor — bedrooms, bathrooms, area, base price, amenities — against
 * `crm/projects/{id}/typologies`, while post_project's `plans[]` only carries a
 * title and a document. Creating the project here and then defining typologies
 * and units on its detail screen uses the better of the two, instead of
 * seeding rows the CRM would immediately have to re-edit.
 */

import { api } from '@/lib/api'
import type { ProjectStage } from './projects'

interface Envelope<T> {
  error: boolean
  message?: string
  data: T
  total?: number
}

export interface ProjectForm {
  title: string
  description: string
  category_id: string
  type: ProjectStage
  country: string
  state: string
  city: string
  location: string
  latitude: string
  longitude: string
  video_link: string
  slug_id: string
  meta_title: string
  meta_description: string
  meta_keywords: string
}

export interface ProjectMedia {
  /** post_project calls it `image`, not `title_image`. Required on create. */
  image: File | null
  gallery_images: File[]
  documents: File[]
  meta_image: File | null
}

export const EMPTY_PROJECT_FORM: ProjectForm = {
  title: '',
  description: '',
  category_id: '',
  type: 'upcoming',
  country: '',
  state: '',
  city: '',
  location: '',
  latitude: '',
  longitude: '',
  video_link: '',
  slug_id: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
}

export const EMPTY_PROJECT_MEDIA: ProjectMedia = {
  image: null,
  gallery_images: [],
  documents: [],
  meta_image: null,
}

const IMAGE_MAX_BYTES = 3000 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg']

/**
 * post_project's video rule is looser than post_property's — host only, no
 * eleven-character id — so this mirrors that one rather than reusing the
 * stricter regex and rejecting links the server would accept.
 */
const YOUTUBE_HOST = /^(https?:\/\/)?(www\.youtube\.com|youtu\.be)\/.+$/

export type ProjectField = keyof ProjectForm | 'image'

/** Mirrors post_project's create-branch validator. */
export function validateProject(form: ProjectForm, media: ProjectMedia): ProjectField | null {
  if (form.title.trim() === '') return 'title'
  if (form.description.trim() === '') return 'description'
  if (form.category_id === '') return 'category_id'

  if (form.country.trim() === '') return 'country'
  if (form.state.trim() === '') return 'state'
  if (form.city.trim() === '') return 'city'

  if (media.image === null) return 'image'
  if (!IMAGE_TYPES.includes(media.image.type)) return 'image'
  if (media.image.size > IMAGE_MAX_BYTES) return 'image'

  const video = form.video_link.trim()
  if (video !== '' && !YOUTUBE_HOST.test(video)) return 'video_link'

  return null
}

export function projectPayload(form: ProjectForm, media: ProjectMedia): FormData {
  const body = new FormData()

  const put = (key: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed !== '') body.append(key, trimmed)
  }

  put('title', form.title)
  put('description', form.description)
  put('category_id', form.category_id)
  put('type', form.type)
  put('country', form.country)
  put('state', form.state)
  put('city', form.city)
  put('location', form.location)
  put('latitude', form.latitude)
  put('longitude', form.longitude)
  put('video_link', form.video_link)
  put('slug_id', form.slug_id)
  put('meta_title', form.meta_title)
  put('meta_description', form.meta_description)
  put('meta_keywords', form.meta_keywords)

  if (media.image !== null) body.append('image', media.image)
  if (media.meta_image !== null) body.append('meta_image', media.meta_image)
  media.gallery_images.forEach((file, index) => {
    body.append(`gallery_images[${index}]`, file)
  })
  media.documents.forEach((file, index) => {
    body.append(`documents[${index}]`, file)
  })

  return body
}

/**
 * post_project is an upsert — this module only ever creates, so no `id` is
 * ever appended. Sending one would silently edit whatever project it named.
 */
export async function createProject(body: FormData): Promise<{ id: number } | null> {
  const response = await api<Envelope<{ id: number } | { id: number }[]>>('post_project', {
    method: 'POST',
    body,
  })

  const data = response.data

  return Array.isArray(data) ? (data[0] ?? null) : data
}
