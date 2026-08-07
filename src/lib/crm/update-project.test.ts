import { describe, expect, it } from 'vitest'
import { toProjectForm } from './update-project'

/**
 * The prefill is the whole risk in the edit screen: a field that arrives as
 * null and becomes the string "null", or a stage the select cannot represent,
 * is a field the agent silently overwrites by pressing Save.
 */
describe('toProjectForm', () => {
  it('turns every null into an empty string, never the word null', () => {
    const form = toProjectForm({
      id: 7,
      title: 'Torre Central',
      description: null,
      category_id: null,
      type: 'upcoming',
      country: null,
      state: null,
      city: null,
      location: null,
      latitude: null,
      longitude: null,
      video_link: null,
      slug_id: null,
      meta_title: null,
      meta_description: null,
      meta_keywords: null,
    })

    expect(form.title).toBe('Torre Central')
    for (const value of Object.values(form)) {
      expect(value).not.toBe('null')
      expect(value).not.toBe('undefined')
    }
    expect(form.description).toBe('')
    expect(form.category_id).toBe('')
  })

  it('stringifies the numeric fields the API sends as numbers', () => {
    const form = toProjectForm({
      id: 7,
      title: 'Torre Central',
      category_id: 12,
      latitude: 18.4712345,
      longitude: -69.9312345,
    })

    expect(form.category_id).toBe('12')
    expect(form.latitude).toBe('18.4712345')
    expect(form.longitude).toBe('-69.9312345')
  })

  it('falls back to upcoming when the record carries a stage the select cannot show', () => {
    // `projects.type` is the agent-controlled stage, frozen to two values in
    // phase 4. Anything else must not round-trip through the select as if it
    // were one of them.
    expect(toProjectForm({ id: 7, title: 'x', type: 'sold_out' }).type).toBe('upcoming')
    expect(toProjectForm({ id: 7, title: 'x', type: null }).type).toBe('upcoming')
    expect(toProjectForm({ id: 7, title: 'x', type: 'under_process' }).type).toBe('under_process')
  })
})
