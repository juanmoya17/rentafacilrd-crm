import { describe, expect, it, vi } from 'vitest'
import type { Stripe } from '@stripe/stripe-js'
import { stripeFor, type StripeLoader } from './stripe-loader'

// Each test uses its own publishable key — the cache is module-level state,
// so a shared key would leak results between tests.
let nextKey = 0
const key = (): string => `pk_test_${(nextKey++).toString()}`

const fakeStripe = {} as unknown as Stripe

describe('stripeFor()', () => {
  it('caches a successful load — two calls with the same key invoke the loader once', async () => {
    const load: StripeLoader = vi.fn().mockResolvedValue(fakeStripe)
    const k = key()

    const first = await stripeFor(k, load)
    const second = await stripeFor(k, load)

    expect(first).toBe(fakeStripe)
    expect(second).toBe(fakeStripe)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('evicts a rejected load — the promise rejects and the cache entry is gone', async () => {
    const load: StripeLoader = vi.fn().mockRejectedValue(new Error('blocked'))
    const k = key()

    await expect(stripeFor(k, load)).rejects.toThrow('blocked')
    // If the rejected promise were still cached, this second call would
    // return the same cached (rejected) promise without calling `load` again.
    await expect(stripeFor(k, load)).rejects.toThrow('blocked')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('retries after a rejection and can succeed — this is the one that pins the bug', async () => {
    const load: StripeLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(fakeStripe)
    const k = key()

    await expect(stripeFor(k, load)).rejects.toThrow('blocked')
    // A naive Map cache stores the promise on the FIRST call, before it
    // settles, so a second call would hit the cache and hand back the same
    // dead, already-rejected promise forever — `load` would never run again
    // and the payment form would stay broken for the rest of the SPA session.
    await expect(stripeFor(k, load)).resolves.toBe(fakeStripe)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
