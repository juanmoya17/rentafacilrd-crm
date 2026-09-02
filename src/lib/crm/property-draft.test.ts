import { describe, expect, it } from 'vitest'
import { EMPTY_PROPERTY_FORM } from './create-property'
import { readDraft, serializeDraft, type PropertyDraft } from './property-draft'

const now = 1_700_000_000_000
const write = (over: Partial<PropertyDraft> = {}) =>
  serializeDraft(
    {
      form: EMPTY_PROPERTY_FORM,
      parameters: {},
      facilities: {},
      translations: {},
      step: 'category',
      ...over,
    },
    now,
  )

describe('property draft', () => {
  it('round-trips the form and the step the agent was on', () => {
    const form = { ...EMPTY_PROPERTY_FORM, title: 'Apto en Naco', price: '120000' }

    const restored = readDraft(write({ form, step: 'details' }), now + 1000)

    expect(restored?.form.title).toBe('Apto en Naco')
    expect(restored?.form.price).toBe('120000')
    expect(restored?.step).toBe('details')
  })

  it('drops a draft older than a week', () => {
    const eightDays = now + 8 * 24 * 60 * 60 * 1000

    expect(readDraft(write(), eightDays)).toBeNull()
  })

  it('keeps one that is a day old', () => {
    expect(readDraft(write(), now + 24 * 60 * 60 * 1000)).not.toBeNull()
  })

  it('survives corrupt storage instead of taking the screen down', () => {
    expect(readDraft('{no es json', now)).toBeNull()
    expect(readDraft('null', now)).toBeNull()
    expect(readDraft('', now)).toBeNull()
    expect(readDraft(null, now)).toBeNull()
  })

  it('refuses a draft written by an older shape of the form', () => {
    const stale = JSON.stringify({ version: 0, savedAt: now, form: EMPTY_PROPERTY_FORM })

    expect(readDraft(stale, now)).toBeNull()
  })

  /**
   * ParameterValues is `string | string[] | File`, and JSON.stringify turns a
   * File into `{}` — restoring one would put an empty object where a document
   * was and let the form call it filled.
   */
  it('leaves File parameters out rather than storing them as {}', () => {
    const parameters = { 7: new File([''], 'plano.pdf'), 8: 'Sí' }

    const restored = readDraft(write({ parameters }), now)

    expect(restored?.parameters).toEqual({ 8: 'Sí' })
    expect(restored?.droppedFiles).toBe(true)
  })

  it('says nothing was dropped when nothing was', () => {
    expect(readDraft(write({ parameters: { 8: 'Sí' } }), now)?.droppedFiles).toBe(false)
  })
})
