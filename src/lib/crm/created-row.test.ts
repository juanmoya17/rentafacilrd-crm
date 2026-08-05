import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { createdRow } from './api'

/**
 * The refusal `HelperService::updatePackageLimit()` sends when the agent holds
 * no active package: a *success* envelope at HTTP 200 that created nothing.
 */
const noPackage = {
  error: false,
  message: 'No active package found. Please purchase a package to continue',
  data: null,
  code: 200,
}

describe('createdRow()', () => {
  it('throws the server message when a success envelope created nothing', () => {
    expect(() => createdRow(noPackage)).toThrow(ApiError)
    expect(() => createdRow(noPackage)).toThrow(/No active package found/)
  })

  it('throws on an empty collection, which post_property returns as []', () => {
    expect(() => createdRow({ error: false, data: [] })).toThrow(ApiError)
  })

  it('unwraps a collection of one — post_property answers with a list', () => {
    expect(createdRow({ error: false, data: [{ id: 7 }] })).toEqual({ id: 7 })
  })

  it('unwraps a bare object — post_project answers with the row itself', () => {
    expect(createdRow({ error: false, data: { id: 7 } })).toEqual({ id: 7 })
  })
})
