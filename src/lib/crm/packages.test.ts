import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import {
  createPaymentIntent,
  getPendingBankTransfer,
  paymentMethods,
  receiptError,
  readCatalog,
  type Package,
  RECEIPT_MAX_BYTES,
} from './packages'

const paid = (id: number): Package => ({
  id,
  name: `Plan ${id}`,
  translated_name: null,
  package_type: 'paid',
  price: 2500,
  effective_price: 2500,
  duration: 30,
  features: [],
  start_date: null,
  end_date: null,
})

const free = (id: number): Package => ({ ...paid(id), package_type: 'free', price: 0 })

describe('readCatalog()', () => {
  it('drops free packages from the buyable catalog', () => {
    const result = readCatalog({ error: false, data: [paid(1), free(2)] })
    expect(result.available.map((p) => p.id)).toEqual([1])
  })

  it('keeps a held free plan — the filter is catalog-only', () => {
    const result = readCatalog({ error: false, data: [], active_packages: [free(9)] })
    expect(result.active.map((p) => p.id)).toEqual([9])
  })

  it('tolerates a null data and a missing active_packages sibling', () => {
    const result = readCatalog({ error: false, data: null })
    expect(result).toEqual({ available: [], active: [] })
  })
})

describe('paymentMethods()', () => {
  it('reads the enable flags as the "1" strings the settings table stores', () => {
    const result = paymentMethods([
      { type: 'paypal_gateway', data: '1' },
      { type: 'stripe_gateway', data: '0' },
      { type: 'bank_transfer_status', data: '1' },
      { type: 'stripe_publishable_key', data: 'pk_test_123' },
      { type: 'stripe_currency', data: 'DOP' },
    ])
    expect(result).toEqual({
      paypal: true,
      stripe: false,
      bank: true,
      stripeKey: 'pk_test_123',
      stripeCurrency: 'DOP',
    })
  })

  it('defaults every gateway off when the row is absent', () => {
    expect(paymentMethods([])).toEqual({
      paypal: false,
      stripe: false,
      bank: false,
      stripeKey: null,
      stripeCurrency: 'USD',
    })
  })
})

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  globalThis.fetch = fetchMock
  fetchMock.mockReset()
  Object.defineProperty(globalThis, 'document', {
    value: { cookie: 'XSRF-TOKEN=tok-1' },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPaymentIntent()', () => {
  it('unwraps the PayPal checkout url', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        error: false,
        data: {
          payment_intent: {
            payment_transaction_id: 41,
            payment_url: 'https://paypal.test/checkout/41',
          },
        },
      }),
    )

    await expect(createPaymentIntent(7, 'paypal')).resolves.toEqual({
      transactionId: 41,
      paypalUrl: 'https://paypal.test/checkout/41',
      clientSecret: null,
    })
  })

  it('unwraps the Stripe client secret', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        error: false,
        data: {
          payment_intent: {
            payment_transaction_id: 42,
            payment_gateway_response: { client_secret: 'pi_1_secret_x' },
          },
        },
      }),
    )

    await expect(createPaymentIntent(7, 'stripe')).resolves.toEqual({
      transactionId: 42,
      paypalUrl: null,
      clientSecret: 'pi_1_secret_x',
    })
  })

  it('throws the server message when the gateway field the method needs is missing', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          error: false,
          message: 'None of payment method is activated',
          data: { payment_intent: { payment_transaction_id: 43 } },
        }),
      ),
    )

    await expect(createPaymentIntent(7, 'paypal')).rejects.toThrow(
      /None of payment method is activated/,
    )
    await expect(createPaymentIntent(7, 'paypal')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('getPendingBankTransfer()', () => {
  it('reports a transfer awaiting admin review', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        error: false,
        data: [{ payment_status: 'review', package: { name: 'Plan Agente' } }],
      }),
    )

    await expect(getPendingBankTransfer()).resolves.toEqual({ packageName: 'Plan Agente' })
  })

  it('returns null when the latest transfer already resolved', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: false, data: [{ payment_status: 'succeed', package: null }] }),
    )

    await expect(getPendingBankTransfer()).resolves.toBeNull()
  })

  it('returns null when the endpoint omits `data` entirely, which it does for no rows', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: false, message: 'No Data Found' }))

    await expect(getPendingBankTransfer()).resolves.toBeNull()
  })
})

describe('receiptError()', () => {
  it('rejects a file past the server 6 MB ceiling before it is uploaded', () => {
    const big = new File([new Uint8Array(1)], 'r.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: RECEIPT_MAX_BYTES + 1 })
    expect(receiptError(big)).toBe('tooLarge')
  })

  it('rejects an extension the server validator does not list', () => {
    expect(receiptError(new File([], 'receipt.heic'))).toBe('badType')
  })

  it('accepts a pdf', () => {
    expect(receiptError(new File([], 'receipt.pdf'))).toBeNull()
  })
})
