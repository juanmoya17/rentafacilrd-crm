import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { classifyBatchError, propertyParams } from './properties'

describe('propertyParams', () => {
  it('drops empty and undefined values so the URL stays clean', () => {
    expect(propertyParams({ search: '', lifecycle: undefined, sort: 'newest' })).toEqual({
      sort: 'newest',
    })
  })

  it('passes an RF code through untouched — the server parses the prefix', () => {
    expect(propertyParams({ search: 'RF0412' }).search).toBe('RF0412')
  })

  it('serialises numbers and the featured boolean as strings', () => {
    expect(propertyParams({ city_id: 3, price_min: 0, is_featured: false })).toEqual({
      city_id: '3',
      price_min: '0',
      is_featured: 'false',
    })
  })

  it('keeps offset and limit, since the pager depends on them', () => {
    expect(propertyParams({ offset: 30, limit: 30 })).toEqual({ offset: '30', limit: '30' })
  })
})

describe('classifyBatchError', () => {
  const err = (status: number, payload: unknown): ApiError =>
    new ApiError('boom', status, payload)

  it('reads the exact shortfall out of a 409', () => {
    const result = classifyBatchError(
      err(409, { error: true, message: 'Not enough', data: { need: 20, have: 12, short: 8 } }),
    )
    expect(result).toEqual({ kind: 'shortfall', shortfall: { need: 20, have: 12, short: 8 } })
  })

  it('separates the not-approved refusal, which lists the offending ids', () => {
    const result = classifyBatchError(
      err(409, { error: true, message: 'Property is not approved', data: { not_approved: [7, 9] } }),
    )
    expect(result).toEqual({ kind: 'notApproved', ids: [7, 9] })
  })

  it('separates the already-featured refusal', () => {
    const result = classifyBatchError(
      err(409, { error: true, message: 'already', data: { already_featured: [4] } }),
    )
    expect(result).toEqual({ kind: 'alreadyFeatured', ids: [4] })
  })

  it('treats a 404 as a stale selection', () => {
    expect(classifyBatchError(err(404, { error: true, message: 'not found' })).kind).toBe('stale')
  })

  it('falls back to the server message for anything else', () => {
    expect(classifyBatchError(err(422, { error: true, message: 'ids required' }))).toEqual({
      kind: 'other',
      message: 'ids required',
    })
  })

  it('survives a non-ApiError without throwing', () => {
    expect(classifyBatchError(new Error('offline')).kind).toBe('other')
  })
})
