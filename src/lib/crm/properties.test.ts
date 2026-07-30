import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import type { Translate } from '@/lib/i18n/context'
import { classifyBatchError, messageFor, propertyParams, type BatchFailure } from './properties'

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

describe('messageFor', () => {
  // Echoes the key and interpolates vars so assertions can check the exact
  // pieces without depending on the real dictionaries.
  const t: Translate = (key, vars) => {
    if (vars === undefined) return key
    return `${key}(${Object.entries(vars)
      .map(([name, value]) => `${name}=${value}`)
      .join(',')})`
  }

  it('produces a non-empty string for every kind', () => {
    const failures: BatchFailure[] = [
      { kind: 'shortfall', shortfall: { need: 20, have: 12, short: 8 } },
      { kind: 'notApproved', ids: [7, 9] },
      { kind: 'alreadyFeatured', ids: [4] },
      { kind: 'stale' },
      { kind: 'other', message: 'ids required' },
    ]
    for (const failure of failures) {
      expect(messageFor(failure, t).length).toBeGreaterThan(0)
    }
  })

  it('carries the exact shortfall numbers and says nothing changed', () => {
    const result = messageFor({ kind: 'shortfall', shortfall: { need: 20, have: 12, short: 8 } }, t)
    expect(result).toBe('bulk.shortfall(need=20,have=12,short=8) bulk.nothingChanged')
  })

  it('carries the offending count for notApproved and alreadyFeatured, and says nothing changed', () => {
    expect(messageFor({ kind: 'notApproved', ids: [7, 9] }, t)).toBe(
      'bulk.notApproved(count=2) bulk.nothingChanged',
    )
    expect(messageFor({ kind: 'alreadyFeatured', ids: [4] }, t)).toBe(
      'bulk.alreadyFeatured(count=1) bulk.nothingChanged',
    )
  })

  it('does not append nothingChanged to a stale selection — onStale() already covers it', () => {
    expect(messageFor({ kind: 'stale' }, t)).toBe('bulk.stale')
  })

  it('keeps the server message for "other" but still says nothing changed', () => {
    expect(messageFor({ kind: 'other', message: 'ids required' }, t)).toBe(
      'ids required bulk.nothingChanged',
    )
  })
})
