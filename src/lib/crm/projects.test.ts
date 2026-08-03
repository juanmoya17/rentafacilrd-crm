import { describe, expect, it } from 'vitest'
import { UNIT_STATUSES, inventoryState } from './projects'

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

describe('UNIT_STATUSES', () => {
  it('keeps the canonical order the inventory columns are built from', () => {
    // Mirrors ProjectUnit::STATUSES. The inventory table takes its columns
    // from this list rather than from the data, so a status nothing is in
    // keeps its column instead of vanishing from the report.
    expect(UNIT_STATUSES).toEqual(['available', 'reserved', 'sold', 'unavailable'])
  })
})
