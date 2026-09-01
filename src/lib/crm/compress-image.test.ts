import { describe, expect, it } from 'vitest'
import { fittedSize, needsCompression } from './compress-image'

/** `size` is read-only on File, so a fake big photo has to be defined onto it. */
const file = (type: string, bytes: number): File =>
  Object.defineProperty(new File([], 'foto.jpg', { type }), 'size', { value: bytes })

describe('needsCompression', () => {
  it('leaves a small photo alone: re-encoding only loses quality', () => {
    expect(needsCompression(file('image/jpeg', 400 * 1024))).toBe(false)
  })

  it('compresses one over the budget', () => {
    // A phone photo is 4-8MB and the server refuses anything over 3MB, so
    // today these are rejected outright rather than merely slow.
    expect(needsCompression(file('image/jpeg', 6_000_000))).toBe(true)
  })

  it('never touches a type the server would refuse anyway', () => {
    expect(needsCompression(file('image/gif', 6_000_000))).toBe(false)
    expect(needsCompression(file('application/pdf', 6_000_000))).toBe(false)
  })

  it('compresses PNG too — a screenshot of a floor plan is easily 10MB', () => {
    expect(needsCompression(file('image/png', 10_000_000))).toBe(true)
  })
})

describe('fittedSize', () => {
  it('leaves an image already within bounds untouched', () => {
    expect(fittedSize(1200, 800, 1920)).toEqual({ width: 1200, height: 800 })
  })

  it('scales the long edge down and keeps the ratio', () => {
    expect(fittedSize(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440 })
  })

  it('works when the long edge is the height', () => {
    expect(fittedSize(3024, 4032, 1920)).toEqual({ width: 1440, height: 1920 })
  })

  it('rounds to whole pixels — a fractional canvas silently rounds itself', () => {
    const { width, height } = fittedSize(4000, 2251, 1920)
    expect(Number.isInteger(width) && Number.isInteger(height)).toBe(true)
  })
})
