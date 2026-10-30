import { describe, expect, it } from 'vitest'
import type { AuthState } from '@/lib/auth-context'
import { EMPTY_PROPERTY_MEDIA } from './create-property'
import {
  canEditProperty,
  propertyIdOf,
  propertyUpdatePayload,
  toPropertyEdit,
  type AddedPropertyRow,
} from './update-property'

/** A rejected listing as get-added-properties sends it. */
const row: AddedPropertyRow = {
  id: 12,
  added_by: 5,
  category_id: 3,
  propery_type: 'rent',
  rentduration: 'Monthly',
  title: 'Casa en Naco',
  slug_id: 'casa-en-naco',
  description: 'Tres habitaciones.',
  price: 45000,
  condition: 'de_reventa',
  area: 120,
  land_area: null,
  country: 'República Dominicana',
  state: 'Distrito Nacional',
  city: 'Santo Domingo',
  address: 'Calle 1',
  client_address: null,
  latitude: '18.4748198',
  longitude: '-69.9315716',
  video_link: null,
  meta_title: 'Casa',
  meta_description: null,
  meta_keywords: 'casa',
  gallery: [{ id: 1 }, { id: 2 }],
  parameters: [
    { id: 7, type_of_parameter: 'number', value: '3' },
    { id: 8, type_of_parameter: 'checkbox', value: 'Piscina,Gimnasio' },
    { id: 9, type_of_parameter: 'radiobutton', value: 'Si' },
  ],
  assign_facilities: [{ facility_id: 4, distance: '1.5' }],
  translations: [
    { id: 70, language_id: 2, key: 'title', value: 'House in Naco' },
    { id: 71, language_id: 2, key: 'description', value: 'Three bedrooms.' },
  ],
  reject_reason: { reason: 'Las fotos no son de la propiedad.' },
}

const keys = (body: FormData) => [...new Set(body.keys())].sort()

describe('propertyIdOf', () => {
  it('reads the id back out of an RF code', () => {
    expect(propertyIdOf('RF0012')).toBe(12)
    expect(propertyIdOf('RF12345')).toBe(12345)
  })

  it('refuses anything that is not one, so the API is never asked', () => {
    expect(propertyIdOf('new')).toBeNull()
    expect(propertyIdOf('RF')).toBeNull()
    expect(propertyIdOf('RF0000')).toBeNull()
  })
})

describe('canEditProperty', () => {
  const me: AuthState = { status: 'authenticated', user: { id: 5, name: 'Ana', email: 'a@x.com' } }

  it('lets the agent edit their own listing and an admin edit any', () => {
    expect(canEditProperty(false, me, 5)).toBe(true)
    expect(canEditProperty(false, me, 6)).toBe(false)
    expect(canEditProperty(true, me, 6)).toBe(true)
  })

  it('fails closed with nobody signed in', () => {
    expect(canEditProperty(false, { status: 'loading' }, 5)).toBe(false)
  })
})

describe('toPropertyEdit', () => {
  const source = toPropertyEdit(row)

  it('turns the wire row into form strings, never the word null', () => {
    expect(source.values.form.property_type).toBe('1')
    expect(source.values.form.price).toBe('45000')
    expect(source.values.form.category_id).toBe('3')
    expect(source.values.form.land_area).toBe('')
    expect(source.values.form.client_address).toBe('')
    for (const value of Object.values(source.values.form)) expect(value).not.toBe('null')
  })

  it('reads a closed listing as its operation', () => {
    expect(toPropertyEdit({ ...row, propery_type: 'sold' }).values.form.property_type).toBe('0')
    expect(toPropertyEdit({ ...row, propery_type: 'rented' }).values.form.property_type).toBe('1')
  })

  it('carries parameters, facilities, translations and the rejection', () => {
    expect(source.values.parameters).toEqual({ 7: '3', 8: ['Piscina', 'Gimnasio'], 9: 'Si' })
    expect(source.values.facilities).toEqual({ 4: '1.5' })
    expect(source.values.translations).toEqual({
      2: { title: 'House in Naco', description: 'Three bedrooms.' },
    })
    expect(source.galleryCount).toBe(2)
    expect(source.rejectReason).toBe('Las fotos no son de la propiedad.')
  })

  it('has no rejection for a listing that was not rejected', () => {
    // The app endpoint sends `{}` there, not null.
    expect(toPropertyEdit({ ...row, reject_reason: {} }).rejectReason).toBeNull()
  })
})

describe('propertyUpdatePayload', () => {
  const source = toPropertyEdit(row)

  /** What every edit carries whatever changed — see the payload's docblock. */
  const ALWAYS = [
    'action_type',
    'facilities[0][distance]',
    'facilities[0][facility_id]',
    'id',
    'latitude',
    'longitude',
    'meta_description',
    'meta_keywords',
    'meta_title',
    'price',
  ]

  it('sends nothing but the id and what the server needs when nothing changed', () => {
    const body = propertyUpdatePayload(source, source.values, EMPTY_PROPERTY_MEDIA)

    expect(keys(body)).toEqual(ALWAYS)
    expect(body.get('id')).toBe('12')
    expect(body.get('action_type')).toBe('0')
    // Re-sent as they were: the server blanks any of these it does not get.
    expect(body.get('meta_title')).toBe('Casa')
    expect(body.get('meta_description')).toBe('')
  })

  it('adds only the fields that changed', () => {
    const body = propertyUpdatePayload(
      source,
      { ...source.values, form: { ...source.values.form, description: 'Cuatro habitaciones.' } },
      EMPTY_PROPERTY_MEDIA,
    )

    expect(keys(body)).toEqual([...ALWAYS, 'description'].sort())
    expect(body.get('description')).toBe('Cuatro habitaciones.')
  })

  it('keeps the saved slug when only the title changes, so the public URL survives', () => {
    // The handler rebuilds the slug from the title unless it receives one.
    const body = propertyUpdatePayload(
      source,
      { ...source.values, form: { ...source.values.form, title: 'Casa en Naco, 3 hab.' } },
      EMPTY_PROPERTY_MEDIA,
    )

    expect(keys(body)).toEqual([...ALWAYS, 'slug_id', 'title'].sort())
    expect(body.get('title')).toBe('Casa en Naco, 3 hab.')
    expect(body.get('slug_id')).toBe('casa-en-naco')
  })

  it('sends a cleared field empty, so the server clears it', () => {
    const body = propertyUpdatePayload(
      source,
      { ...source.values, form: { ...source.values.form, condition: '' } },
      EMPTY_PROPERTY_MEDIA,
    )

    expect(body.get('condition')).toBe('')
  })

  it('sends the duration with a switch to rent, which the server then requires', () => {
    const sale = toPropertyEdit({ ...row, propery_type: 'sell' })
    const body = propertyUpdatePayload(
      sale,
      { ...sale.values, form: { ...sale.values.form, property_type: '1' } },
      EMPTY_PROPERTY_MEDIA,
    )

    expect(body.get('property_type')).toBe('1')
    expect(body.get('rentduration')).toBe('Monthly')
  })

  it('sends changed parameters, and a removed one as empty', () => {
    const parameters = { ...source.values.parameters, 7: '4' }
    delete (parameters as Record<number, unknown>)[9]
    const body = propertyUpdatePayload(source, { ...source.values, parameters }, EMPTY_PROPERTY_MEDIA)

    expect(body.get('parameters[0][parameter_id]')).toBe('7')
    expect(body.get('parameters[0][value]')).toBe('4')
    expect(body.get('parameters[1][parameter_id]')).toBe('9')
    expect(body.get('parameters[1][value]')).toBe('')
    expect(body.has('parameters[2][parameter_id]')).toBe(false)
  })

  it('updates a changed translation in place, by its id', () => {
    const body = propertyUpdatePayload(
      source,
      {
        ...source.values,
        translations: { 2: { title: 'House in Naco, 3 bed', description: 'Three bedrooms.' } },
      },
      EMPTY_PROPERTY_MEDIA,
    )

    expect(body.get('translations[0][title][translation_id]')).toBe('70')
    expect(body.get('translations[0][title][value]')).toBe('House in Naco, 3 bed')
    expect(body.has('translations[0][description][value]')).toBe(false)
  })

  it('adds new photos without touching the saved ones', () => {
    const photo = new File([new Uint8Array(10)], 'nueva.jpg', { type: 'image/jpeg' })
    const body = propertyUpdatePayload(source, source.values, {
      ...EMPTY_PROPERTY_MEDIA,
      gallery_images: [photo],
    })

    expect(body.get('gallery_images[0]')).toBeInstanceOf(File)
    expect(body.has('remove_gallery_images')).toBe(false)
  })
})
