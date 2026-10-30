import { describe, expect, it } from 'vitest'

import { calendarDateEnd, formatDateValue } from './format-date'

describe('formatDateValue', () => {
  it('keeps a calendar date on its own day', () => {
    expect(formatDateValue('es-DO', '2026-11-07')).toContain('7')
  })

  it('reads an instant in Santo Domingo time', () => {
    // 00:00Z is 20:00 on the 6th in Santo Domingo (UTC-4).
    const out = formatDateValue('es-DO', '2026-11-07T00:00:00Z', { day: 'numeric' })
    expect(out).toBe('6')
  })

  it('merges caller options with the time zone', () => {
    const out = formatDateValue('en-US', '2026-11-07T00:00:00Z', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    expect(out).toContain('11/6/26')
    expect(out).toContain('8:00')
  })
})

describe('calendarDateEnd', () => {
  it('runs a bare date to the end of that day in Santo Domingo', () => {
    expect(calendarDateEnd('2026-11-07').toISOString()).toBe('2026-11-08T03:59:59.000Z')
  })

  it('passes an instant through', () => {
    expect(calendarDateEnd('2026-11-07T10:00:00Z').toISOString()).toBe('2026-11-07T10:00:00.000Z')
  })
})
