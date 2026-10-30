import { describe, expect, it } from 'vitest'
import { claimEmptyKey } from './empty-states'

describe('claimEmptyKey', () => {
  it('names the empty state when nothing is pending', () => {
    expect(claimEmptyKey(0)).toBe('claim.empty')
  })

  it('has nothing to say once there are listings', () => {
    expect(claimEmptyKey(2)).toBeNull()
  })
})
