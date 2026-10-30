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

  it('turns an unknown field into readable text', () => {
    expect(activityFieldLabel('some_new_field', tEs)).toBe('some new field')
  })
})

describe('activityValueLabel', () => {
  it('translates stage values with the existing stage labels', () => {
    expect(activityValueLabel('stage', 'negotiation', tEs)).toBe('Negociación')
    expect(activityValueLabel('stage', 'won', tEn)).toBe('Won')
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
