import { describe, expect, it } from 'vitest'
import { freeQuotaBanner } from './free-quota'

describe('freeQuotaBanner()', () => {
  it('says how many are left', () => {
    expect(freeQuotaBanner({ total: 7, used: 2, reserved: 1, remaining: 4 })).toEqual({
      tone: 'info',
      key: 'freeQuota.left',
      vars: { count: 4 },
    })
  })

  it('uses the singular for the last one', () => {
    expect(freeQuotaBanner({ total: 3, used: 2, reserved: 0, remaining: 1 })?.key).toBe(
      'freeQuota.leftOne',
    )
  })

  it('warns when the allowance is spent', () => {
    expect(freeQuotaBanner({ total: 3, used: 3, reserved: 0, remaining: 0 })).toEqual({
      tone: 'warning',
      key: 'freeQuota.used',
      vars: { total: 3 },
    })
  })

  it('clamps a negative remaining to spent', () => {
    expect(freeQuotaBanner({ total: 3, used: 5, reserved: 0, remaining: -2 })?.key).toBe(
      'freeQuota.used',
    )
  })

  it('asks an unverified account to verify', () => {
    expect(freeQuotaBanner({ total: 0, used: 0, reserved: 0, remaining: 0 })).toEqual({
      tone: 'warning',
      key: 'freeQuota.verify',
      vars: {},
    })
  })

  it('shows nothing when the server sent no quota (plan, launch toggle, old server)', () => {
    expect(freeQuotaBanner(undefined)).toBeNull()
    expect(freeQuotaBanner(null)).toBeNull()
  })
})
