import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiOrigin, isTrustedPaymentMessage } from './payment-popup'

function stubLocation(origin: string): void {
  vi.stubGlobal('window', { location: { origin } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiOrigin()', () => {
  it('falls back to the page origin when VITE_API_ORIGIN is empty (dev proxies /api)', () => {
    stubLocation('http://localhost:5173')
    expect(apiOrigin('')).toBe('http://localhost:5173')
  })

  it('uses the configured origin in production', () => {
    stubLocation('https://crm.rentafacilrd.com')
    expect(apiOrigin('https://api.rentafacilrd.com')).toBe('https://api.rentafacilrd.com')
  })
})

describe('isTrustedPaymentMessage()', () => {
  const trusted = 'https://api.rentafacilrd.com'

  it('accepts a success message from the API origin', () => {
    expect(
      isTrustedPaymentMessage({ origin: trusted, data: { status: 'success' } }, trusted),
    ).toBe(true)
  })

  it('rejects the same message from any other origin', () => {
    expect(
      isTrustedPaymentMessage(
        { origin: 'https://evil.example', data: { status: 'success' } },
        trusted,
      ),
    ).toBe(false)
  })

  it('rejects a non-success payload from the right origin', () => {
    expect(
      isTrustedPaymentMessage({ origin: trusted, data: { status: 'cancelled' } }, trusted),
    ).toBe(false)
  })

  it('rejects a non-object payload', () => {
    expect(isTrustedPaymentMessage({ origin: trusted, data: 'success' }, trusted)).toBe(false)
  })
})
