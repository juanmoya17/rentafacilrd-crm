import { describe, expect, it } from 'vitest'
import {
  UNIT_STATUSES,
  inventoryState,
  toNumberOrNull,
  validateTypology,
  type TypologyForm,
} from './projects'

describe('inventoryState', () => {
  it('calls a project with no units empty, not sold out', () => {
    // The trap this function exists for: an availability bar at 0% renders
    // identically to a sold-out one, and "agotado" on a project nobody has
    // loaded inventory for is simply wrong.
    expect(inventoryState({ units_total: 0, sold_out: false })).toBe('empty')
  })

  it('trusts the server over the counts when units exist', () => {
    expect(inventoryState({ units_total: 12, sold_out: true })).toBe('sold_out')
    expect(inventoryState({ units_total: 12, sold_out: false })).toBe('available')
  })

  it('still says empty when a zero-unit project somehow claims sold_out', () => {
    // The server cannot produce this pair, but the screen must not invent
    // "agotado" out of an empty inventory if it ever does.
    expect(inventoryState({ units_total: 0, sold_out: true })).toBe('empty')
  })
})

describe('validateTypology', () => {
  const form = (overrides: Partial<TypologyForm> = {}): TypologyForm => ({
    title: 'Tipo A',
    bedrooms: '',
    bathrooms: '',
    area: '',
    base_price: '',
    sort_order: '',
    ...overrides,
  })

  it('accepts a title with every other field empty', () => {
    // Every typology field is nullable server-side. A model with only a name
    // is incomplete data, not invalid data.
    expect(validateTypology(form())).toBeNull()
  })

  it('requires a title', () => {
    expect(validateTypology(form({ title: '   ' }))).toBe('title')
  })

  it('mirrors the 0–255 ceiling on bedrooms and bathrooms', () => {
    // strict => false means MySQL would store 300 as 255 instead of refusing
    // it, so this bound is the only place it fails loudly on either side.
    expect(validateTypology(form({ bedrooms: '256' }))).toBe('bedrooms')
    expect(validateTypology(form({ bathrooms: '256' }))).toBe('bathrooms')
    expect(validateTypology(form({ bedrooms: '255', bathrooms: '0' }))).toBeNull()
  })

  it('rejects a negative or non-numeric measurement', () => {
    expect(validateTypology(form({ area: '-1' }))).toBe('area')
    expect(validateTypology(form({ base_price: '1.2.3' }))).toBe('base_price')
    expect(validateTypology(form({ bedrooms: '2.5' }))).toBe('bedrooms')
    expect(validateTypology(form({ sort_order: '-2' }))).toBe('sort_order')
  })

  it('accepts the decimals the server sends back', () => {
    // The API returns DECIMAL columns as strings ("90.00"), and those land
    // straight back in this form when a typology is edited.
    expect(validateTypology(form({ area: '90.00', base_price: '8900000.00' }))).toBeNull()
  })
})

describe('toNumberOrNull', () => {
  it('turns an emptied field into null, never zero', () => {
    // Clearing an area must clear it. Zero square metres is a claim.
    expect(toNumberOrNull('')).toBeNull()
    expect(toNumberOrNull('   ')).toBeNull()
  })

  it('keeps a real zero', () => {
    expect(toNumberOrNull('0')).toBe(0)
    expect(toNumberOrNull(' 90.5 ')).toBe(90.5)
  })
})

describe('UNIT_STATUSES', () => {
  it('keeps the canonical order the inventory columns are built from', () => {
    // Mirrors ProjectUnit::STATUSES. The inventory table takes its columns
    // from this list rather than from the data, so a status nothing is in
    // keeps its column instead of vanishing from the report.
    expect(UNIT_STATUSES).toEqual(['available', 'reserved', 'sold', 'unavailable'])
  })
})
