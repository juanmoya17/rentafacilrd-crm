import { describe, expect, it } from 'vitest'
import { paymentMethods, readCatalog, type Package } from './packages'

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
