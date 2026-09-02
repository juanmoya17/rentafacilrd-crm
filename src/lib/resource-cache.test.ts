import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceCache } from './resource-cache'

describe('ResourceCache', () => {
  let cache: ResourceCache

  beforeEach(() => {
    cache = new ResourceCache()
  })

  it('serves an entry that is still fresh', () => {
    cache.set('leads', { items: [1] }, 1000)

    expect(cache.get('leads', 1100, 30_000)).toEqual({ items: [1] })
  })

  it('ignores one that has gone stale', () => {
    cache.set('leads', { items: [1] }, 1000)

    expect(cache.get('leads', 40_000, 30_000)).toBeNull()
  })

  it('knows nothing about a key it never saw', () => {
    expect(cache.get('leads', 1000, 30_000)).toBeNull()
  })

  it('can hold a legitimately null value without it reading as a miss', () => {
    // `has` and `get` answer different questions; conflating them is how an
    // endpoint that legitimately returns null gets refetched forever.
    cache.set('agency', null, 1000)

    expect(cache.has('agency', 1100, 30_000)).toBe(true)
  })

  it('invalidates by prefix, so publishing expires every page of the list', () => {
    cache.set('properties?page=1', { items: [] }, 1000)
    cache.set('properties?page=2', { items: [] }, 1000)
    cache.set('leads', { items: [] }, 1000)

    cache.invalidate('properties')

    expect(cache.get('properties?page=1', 1100, 30_000)).toBeNull()
    expect(cache.get('properties?page=2', 1100, 30_000)).toBeNull()
    expect(cache.get('leads', 1100, 30_000)).toEqual({ items: [] })
  })

  it('clears everything on sign-out: the next agent must not see these', () => {
    cache.set('leads', { items: [1] }, 1000)

    cache.clear()

    expect(cache.get('leads', 1100, 30_000)).toBeNull()
  })
})
