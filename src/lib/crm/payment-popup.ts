/**
 * The PayPal return channel.
 *
 * `resources/views/payments/responses/paypal.blade.php` posts
 * `{status:'success', ...}` to `window.opener` with a `'*'` target. The website
 * listener accepts it from any origin; this one does not. The message is treated
 * ONLY as "go refetch" — the grant is the server's, so even a forged message
 * buys nobody anything, and the origin check keeps it that way.
 */

/** Shape of the fields we read off a MessageEvent, so tests need no DOM. */
export interface PaymentMessage {
  origin: string
  data: unknown
}

/**
 * VITE_API_ORIGIN is '' in dev, where Vite proxies /api and the API is
 * same-origin. An empty string would match nothing, so resolve it to the page.
 */
export function apiOrigin(configured: string = import.meta.env.VITE_API_ORIGIN ?? ''): string {
  return configured === '' ? window.location.origin : configured
}

export function isTrustedPaymentMessage(event: PaymentMessage, trusted: string): boolean {
  if (event.origin !== trusted) return false
  const data: unknown = event.data
  return typeof data === 'object' && data !== null && 'status' in data
    ? (data as { status?: unknown }).status === 'success'
    : false
}

/** Centred on the window the agent is actually looking at, not screen 0. */
export function openCentered(url: string, title: string): Window | null {
  const width = 600
  const height = 700
  const left = (window.screenLeft ?? window.screenX) + (window.innerWidth - width) / 2
  const top = (window.screenTop ?? window.screenY) + (window.innerHeight - height) / 2
  return window.open(
    url,
    title,
    `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`,
  )
}
