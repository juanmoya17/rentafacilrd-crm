import { beforeEach, describe, expect, it } from 'vitest'
import { clearScrollStore, readScroll, restoreStep, saveScroll } from '@/lib/scroll-store'

beforeEach(clearScrollStore)

describe('scroll store', () => {
  it('round-trips a position per history key', () => {
    saveScroll('a', 420)
    saveScroll('b', 0)
    expect(readScroll('a')).toBe(420)
    expect(readScroll('b')).toBe(0)
  })

  it('reports an unknown key as undefined, not zero', () => {
    // 0 is a real saved position ("was at the top"); undefined means "never
    // been here". The caller treats them differently.
    expect(readScroll('never-visited')).toBeUndefined()
  })

  it('evicts the oldest entry past the cap and keeps the newest', () => {
    for (let i = 0; i < 55; i++) saveScroll(`k${i}`, i)
    expect(readScroll('k0')).toBeUndefined()
    expect(readScroll('k4')).toBeUndefined()
    expect(readScroll('k5')).toBe(5)
    expect(readScroll('k54')).toBe(54)
  })

  it('treats a re-saved key as newest so it is not evicted', () => {
    saveScroll('keep', 1)
    for (let i = 0; i < 49; i++) saveScroll(`k${i}`, i)
    // 'keep' is now the oldest; touching it should move it to the front.
    saveScroll('keep', 2)
    for (let i = 49; i < 60; i++) saveScroll(`k${i}`, i)
    expect(readScroll('keep')).toBe(2)
  })
})

describe('restoreStep', () => {
  it('is done once the container reached the target', () => {
    expect(restoreStep({ current: 900, target: 900, elapsedMs: 0, deadlineMs: 1000 })).toBe('done')
  })

  it('is done when it settles a pixel or two short', () => {
    // A scrollbar appearing or sub-pixel layout can leave a 1px gap. Retrying
    // over that would spin until the deadline on every back navigation.
    expect(restoreStep({ current: 899, target: 900, elapsedMs: 0, deadlineMs: 1000 })).toBe('done')
  })

  it('retries while the content is still too short and there is time left', () => {
    // The list is still a loading card, so scrollTop clamped far below target.
    expect(restoreStep({ current: 120, target: 900, elapsedMs: 200, deadlineMs: 1000 })).toBe(
      'retry',
    )
  })

  it('gives up once the deadline passes rather than retrying forever', () => {
    // The page may genuinely be shorter now — a filter returned fewer rows, or
    // a record was deleted. Never leave an observer running for that.
    expect(restoreStep({ current: 120, target: 900, elapsedMs: 1000, deadlineMs: 1000 })).toBe(
      'give-up',
    )
  })

  it('is done immediately when the target is the top', () => {
    expect(restoreStep({ current: 0, target: 0, elapsedMs: 0, deadlineMs: 1000 })).toBe('done')
  })
})
