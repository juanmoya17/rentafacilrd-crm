import { describe, expect, it } from 'vitest'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { createTranslate } from '@/lib/i18n/translate'
import { activityFieldLabel, activityValueLabel } from './activity-labels'

const tEs = createTranslate('es-DO', es)
const tEn = createTranslate('en-US', en)

describe('activityFieldLabel', () => {
  it('names known fields in the reader language', () => {
    expect(activityFieldLabel('stage', tEs)).toBe('Etapa')
    expect(activityFieldLabel('stage', tEn)).toBe('Stage')
  })

  it('labels the fields the activity log emits', () => {
    expect(activityFieldLabel('closed_at', tEs)).toBe('Cerrado el')
    expect(activityFieldLabel('reassigned_to', tEn)).toBe('Reassigned to')
    expect(activityFieldLabel('from_member', tEs)).toBe('Traspasado desde')
    expect(activityFieldLabel('agency_id', tEn)).toBe('Agency')
  })

  it('turns an unknown field into readable text', () => {
    expect(activityFieldLabel('some_new_field', tEs)).toBe('some new field')
  })
})

describe('activityValueLabel', () => {
  it('translates stage values with the existing stage labels', () => {
    expect(activityValueLabel('stage', 'negotiation', tEs)).toBe('Negociación')
    expect(activityValueLabel('stage', 'won', tEn)).toBe('Won')
  })

  it('translates origin and role values', () => {
    expect(activityValueLabel('origin', 'whatsapp', tEs)).toBe('WhatsApp')
    expect(activityValueLabel('role', 'agent', tEs)).toBe('Asesor')
    expect(activityValueLabel('role', 'agent', tEn)).toBe('Agent')
  })

  it('translates status and request_status values', () => {
    expect(activityValueLabel('status', 'published', tEs)).toBe('Publicada')
    expect(activityValueLabel('request_status', 'approved', tEs)).toBe('Aprobada')
    expect(activityValueLabel('request_status', 'pending', tEn)).toBe('In review')
  })

  it('formats ISO dates with the reader formatter', () => {
    const fmt = (v: string) => `<${v}>`
    expect(activityValueLabel('closed_at', '2026-10-30T14:00:00Z', tEs, fmt)).toBe('<2026-10-30T14:00:00Z>')
    expect(activityValueLabel('start_date', '2026-11-07', tEs, fmt)).toBe('<2026-11-07>')
    expect(activityValueLabel('title', '2026-11-07', tEs, fmt)).toBe('2026-11-07')
    expect(activityValueLabel('closed_at', 'soon', tEs, fmt)).toBe('soon')
  })

  it('leaves other values and unknown stages as they come', () => {
    expect(activityValueLabel('stage', 'weird', tEs)).toBe('weird')
    expect(activityValueLabel('price', 165000, tEs)).toBe('165000')
  })

  it('shows empty values as a dash', () => {
    expect(activityValueLabel('stage', null, tEs)).toBe('—')
    expect(activityValueLabel('title', '', tEs)).toBe('—')
  })
})
