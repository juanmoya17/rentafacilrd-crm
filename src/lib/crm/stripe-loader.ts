import { loadStripe, type Stripe } from '@stripe/stripe-js'

/**
 * Injectable seam so stripeFor()'s retry-after-rejection behaviour is
 * testable without touching the network or js.stripe.com. Matches
 * loadStripe's own signature (its optional `options` param is simply never
 * passed here).
 */
export type StripeLoader = (publishableKey: string) => Promise<Stripe | null>

/**
 * Stripe's own loadStripe() clears ITS internal script-load cache on
 * rejection precisely so a later call retries. A plain Map cache would defeat
 * that: once an entry exists, a cache hit never calls the loader again, so
 * one transient failure (ad blocker, CSP, flaky network) would wedge the
 * payment form dead for the rest of the SPA session. Evicting on rejection
 * keeps the cache doing its actual job — no re-fetch on a re-opened dialog —
 * while making failures genuinely retryable.
 */
const stripeCache = new Map<string, Promise<Stripe | null>>()

export function stripeFor(
  publishableKey: string,
  load: StripeLoader = loadStripe,
): Promise<Stripe | null> {
  const cached = stripeCache.get(publishableKey)
  if (cached !== undefined) return cached

  const created = load(publishableKey).catch((error: unknown) => {
    stripeCache.delete(publishableKey)
    throw error
  })
  stripeCache.set(publishableKey, created)
  return created
}
