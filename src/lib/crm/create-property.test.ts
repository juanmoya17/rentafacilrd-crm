import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROPERTY_FORM,
  EMPTY_PROPERTY_MEDIA,
  propertyPayload,
  stepOf,
  validateProperty,
  type ParameterValues,
  type PropertyForm,
  type PropertyMedia,
} from './create-property'
import { validateProject, projectPayload, EMPTY_PROJECT_FORM, EMPTY_PROJECT_MEDIA } from './create-project'
import { affirmativeOption } from './reference'

const jpeg = (name = 'cover.jpg', bytes = 1000) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })

/** The minimum post_property accepts, so each test can break exactly one rule. */
const valid: PropertyForm = {
  ...EMPTY_PROPERTY_FORM,
  category_id: '1',
  title: 'Apartamento en Naco',
  description: 'Tres habitaciones, dos parqueos.',
  price: '4500000',
  address: 'Av. Lope de Vega 44',
  latitude: '18.4748198',
  longitude: '-69.9315716',
}

const media: PropertyMedia = { ...EMPTY_PROPERTY_MEDIA, title_image: jpeg() }

const check = (
  form: PropertyForm = valid,
  withMedia: PropertyMedia = media,
  parameters: ParameterValues = {},
  required: { id: number; is_required: number }[] = [],
  galleryLimit: number | null = null,
  mediaRich = true,
) => validateProperty(form, withMedia, parameters, required, galleryLimit, mediaRich)

describe('validateProperty', () => {
  it('accepts the minimum the server requires', () => {
    expect(check()).toBeNull()
  })

  it('requires a rent period only for a rental', () => {
    expect(check({ ...valid, property_type: '1', rentduration: '' })).toBe('rentduration')
    expect(check({ ...valid, property_type: '0', rentduration: '' })).toBeNull()
  })

  // `min:1` on the server. A listing at 0 is a slip, and catching it here saves
  // the agent a multi-megabyte upload.
  it('refuses a zero or non-numeric price', () => {
    expect(check({ ...valid, price: '0' })).toBe('price')
    expect(check({ ...valid, price: '' })).toBe('price')
    expect(check({ ...valid, price: 'RD$ 4,500' })).toBe('price')
  })

  it('refuses a half-placed pin — the server requires both coordinates', () => {
    expect(check({ ...valid, longitude: '' })).toBe('latitude')
    expect(check({ ...valid, latitude: '' })).toBe('latitude')
  })

  it('refuses a missing, oversized or wrongly-typed cover photo', () => {
    expect(check(valid, { ...media, title_image: null })).toBe('title_image')
    expect(check(valid, { ...media, title_image: jpeg('cover.jpg', 3000 * 1024 + 1) })).toBe(
      'title_image',
    )
    expect(
      check(valid, {
        ...media,
        title_image: new File([new Uint8Array(10)], 'plan.pdf', { type: 'application/pdf' }),
      }),
    ).toBe('title_image')
  })

  it('enforces the tier gallery cap, and treats null as unlimited rather than zero', () => {
    const gallery = { ...media, gallery_images: [jpeg('a.jpg'), jpeg('b.jpg')] }
    expect(check(valid, gallery, {}, [], 1)).toBe('gallery_images')
    expect(check(valid, gallery, {}, [], 2)).toBeNull()
    expect(check(valid, gallery, {}, [], null)).toBeNull()
  })

  it('blocks 3D and video when the tier has no media_rich', () => {
    const withVideo = { ...valid, video_link: 'https://youtube.com/watch?v=hpci2MI2BcY' }
    expect(check(withVideo, media, {}, [], null, false)).toBe('video_link')
    expect(check(withVideo, media, {}, [], null, true)).toBeNull()
    expect(check(valid, { ...media, three_d_image: jpeg() }, {}, [], null, false)).toBe(
      'three_d_image',
    )
  })

  it('mirrors the server YouTube rule rather than accepting any URL', () => {
    expect(check({ ...valid, video_link: 'https://vimeo.com/123456789' })).toBe('video_link')
    expect(check({ ...valid, video_link: 'https://youtu.be/hpci2MI2BcY' })).toBeNull()
  })

  it('refuses a document the server would reject on extension or size', () => {
    const doc = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name)
    expect(check(valid, { ...media, documents: [doc('plano.dwg')] })).toBe('documents')
    expect(check(valid, { ...media, documents: [doc('plano.pdf', 5120 * 1024 + 1)] })).toBe(
      'documents',
    )
    expect(check(valid, { ...media, documents: [doc('plano.pdf')] })).toBeNull()
  })

  it('holds a required category parameter, and counts an empty multi-select as unfilled', () => {
    const required = [{ id: 7, is_required: 1 }]
    expect(check(valid, media, {}, required)).toBe('param:7')
    expect(check(valid, media, { 7: [] }, required)).toBe('param:7')
    expect(check(valid, media, { 7: ' ' }, required)).toBe('param:7')
    expect(check(valid, media, { 7: 'Si' }, required)).toBeNull()
  })

  it('routes every failure to the step that owns it', () => {
    expect(stepOf('price')).toBe('details')
    expect(stepOf('latitude')).toBe('location')
    expect(stepOf('title_image')).toBe('media')
    expect(stepOf('param:7')).toBe('parameters')
    expect(stepOf('rentduration')).toBe('category')
  })
})

describe('propertyPayload', () => {
  const entries = (body: FormData) => Object.fromEntries(body.entries())

  it('sends the required fields and omits the empty optional ones', () => {
    const body = entries(propertyPayload(valid, media, {}, {}, {}))

    expect(body.title).toBe('Apartamento en Naco')
    expect(body.price).toBe('4500000')
    expect(body.property_type).toBe('0')
    expect(body.title_image).toBeInstanceOf(File)
    // Absent, not blank: `condition` has an `in:` rule that an empty string
    // fails and an omitted key passes.
    expect('condition' in body).toBe(false)
    expect('meta_title' in body).toBe(false)
  })

  it('sends rentduration only for a rental', () => {
    expect('rentduration' in entries(propertyPayload(valid, media, {}, {}, {}))).toBe(false)
    const rental = { ...valid, property_type: '1' as const, rentduration: 'Monthly' }
    expect(entries(propertyPayload(rental, media, {}, {}, {})).rentduration).toBe('Monthly')
  })

  it('indexes parameters from 0 with no gaps, so a file parameter is found again', () => {
    // The handler reads a file back as `parameters.{index}.value`; skipping an
    // empty value without closing the gap would point it at nothing.
    const file = jpeg('plano.jpg')
    const body = entries(propertyPayload(valid, media, { 3: '', 5: 'Si', 9: file }, {}, {}))

    expect(body['parameters[0][parameter_id]']).toBe('5')
    expect(body['parameters[0][value]']).toBe('Si')
    expect(body['parameters[1][parameter_id]']).toBe('9')
    expect(body['parameters[1][value]']).toBeInstanceOf(File)
    expect('parameters[2][parameter_id]' in body).toBe(false)
  })

  it('joins a multi-select parameter with commas', () => {
    const body = entries(propertyPayload(valid, media, { 4: ['piscina', 'gimnasio'] }, {}, {}))
    expect(body['parameters[0][value]']).toBe('piscina,gimnasio')
  })

  // PHP's empty('0') is true, so a facility sent with distance "0" is dropped
  // by the handler exactly as if it had been left blank.
  it('sends 0.0 for a facility with no distance, never 0 or an empty string', () => {
    const body = entries(propertyPayload(valid, media, {}, { 2: '', 6: '0', 8: '1.5' }, {}))

    expect(body['facilities[0][facility_id]']).toBe('2')
    expect(body['facilities[0][distance]']).toBe('0.0')
    expect(body['facilities[1][distance]']).toBe('0.0')
    expect(body['facilities[2][distance]']).toBe('1.5')
  })

  it('emits translations in the bracket shape the handler walks', () => {
    const body = entries(
      propertyPayload(valid, media, {}, {}, { 2: { title: 'Naco flat', description: '' } }),
    )

    expect(body['translations[0][title][language_id]']).toBe('2')
    expect(body['translations[0][title][value]']).toBe('Naco flat')
    // An empty description is omitted rather than sent blank — the handler
    // stores whatever it receives, and a blank row would overwrite nothing
    // useful while still creating a translation.
    expect('translations[0][description][value]' in body).toBe(false)
  })

  it('indexes gallery images and documents as arrays', () => {
    const body = entries(
      propertyPayload(
        valid,
        { ...media, gallery_images: [jpeg('a.jpg'), jpeg('b.jpg')] },
        {},
        {},
        {},
      ),
    )

    expect(body['gallery_images[0]']).toBeInstanceOf(File)
    expect(body['gallery_images[1]']).toBeInstanceOf(File)
  })
})

describe('validateProject', () => {
  const project = {
    ...EMPTY_PROJECT_FORM,
    title: 'Torre Mirador',
    description: 'Veinte pisos en Piantini.',
    category_id: '1',
    country: 'República Dominicana',
    state: 'Distrito Nacional',
    city: 'Santo Domingo',
  }
  const cover = { ...EMPTY_PROJECT_MEDIA, image: jpeg() }

  it('accepts the six fields post_project requires plus the cover', () => {
    expect(validateProject(project, cover)).toBeNull()
  })

  it('holds each required field', () => {
    expect(validateProject({ ...project, city: '' }, cover)).toBe('city')
    expect(validateProject(project, EMPTY_PROJECT_MEDIA)).toBe('image')
  })

  // post_project's rule is host-only — stricter mirroring here would refuse
  // links the server accepts.
  it('accepts any YouTube path, matching the looser project rule', () => {
    expect(validateProject({ ...project, video_link: 'https://www.youtube.com/@canal' }, cover))
      .toBeNull()
    expect(validateProject({ ...project, video_link: 'https://vimeo.com/1' }, cover)).toBe(
      'video_link',
    )
  })

  it('names the cover `image`, which is what post_project reads', () => {
    const body = Object.fromEntries(projectPayload(project, cover).entries())
    expect(body.image).toBeInstanceOf(File)
    expect('title_image' in body).toBe(false)
    expect(body.title).toBe('Torre Mirador')
  })
})

describe('affirmativeOption', () => {
  const parameter = (
    type: string,
    options: { value: string }[] | null,
  ): Parameters<typeof affirmativeOption>[0] =>
    ({
      id: 1,
      name: 'p',
      type_of_parameter: type,
      is_required: 0,
      translated_option_value: options,
    }) as unknown as Parameters<typeof affirmativeOption>[0]

  // The real shape from api.rentafacilrd.com: every amenity on a house is its
  // own checkbox parameter with exactly Si/No — "Piscina", "Gimnasio",
  // "Balcón" and eighteen more. Rendering each as a labelled Si/No pair is
  // what this detection exists to avoid.
  it('reads Si out of the Si/No pair the panel actually sends', () => {
    expect(affirmativeOption(parameter('checkbox', [{ value: 'Si' }, { value: 'No' }]))).toBe('Si')
  })

  it('treats a lone option as a boolean too — "Amueblado" ships with just Si', () => {
    expect(affirmativeOption(parameter('checkbox', [{ value: 'Si' }]))).toBe('Si')
  })

  it('leaves a genuine two-way choice alone', () => {
    expect(affirmativeOption(parameter('checkbox', [{ value: 'Techado' }, { value: 'Abierto' }])))
      .toBeNull()
  })

  it('leaves a real multi-select alone', () => {
    const many = [{ value: 'A' }, { value: 'B' }, { value: 'C' }]
    expect(affirmativeOption(parameter('checkbox', many))).toBeNull()
  })

  it('only ever applies to checkbox — a radiobutton pair stays a choice', () => {
    expect(affirmativeOption(parameter('radiobutton', [{ value: 'Si' }, { value: 'No' }])))
      .toBeNull()
    expect(affirmativeOption(parameter('number', null))).toBeNull()
  })
})

describe('stepOf', () => {
  // The app writes the description on the parameters screen, after the
  // features the AI writer reads. Routing it to 'details' would send a failed
  // validation to a step that no longer holds the field.
  it('routes the description to the parameters step, not details', () => {
    expect(stepOf('description')).toBe('parameters')
    expect(stepOf('title')).toBe('details')
  })
})
