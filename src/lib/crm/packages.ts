/**
 * Packages and payments for the CRM.
 *
 * These endpoints live OUTSIDE the /api/crm prefix — they are the same ones the
 * Flutter app and the website call, so the shapes mirror ApiController, not the
 * CRM resources. All of them sit under `auth:sanctum`, which the CRM's cookie
 * session already satisfies, so none of this needed backend work.
 */

import { api } from '@/lib/api'
import type { Envelope } from './api'

export interface PackageFeature {
  id: number
  name: string
  translated_name: string | null
  /** 'unlimited' means the limit/used numbers are meaningless for this row. */
  limit_type: 'limited' | 'unlimited'
  limit: number | null
  /** Only populated on packages the agent actually holds. */
  used_limit: number | null
  total_limit: number | null
}

export interface Package {
  id: number
  name: string
  translated_name: string | null
  package_type: 'free' | 'paid'
  price: number
  /** Launch pricing applied server-side; this is what the agent pays. */
  effective_price: number
  duration: number
  features: PackageFeature[]
  /** Active packages only. */
  start_date?: string | null
  end_date?: string | null
}

export interface PackageCatalog {
  /** Buyable now. Free packages are excluded — see readCatalog. */
  available: Package[]
  /** What the agent already holds, free ones included. */
  active: Package[]
}

/**
 * get-package returns the catalog in `data` but the caller's own plans in a
 * TOP-LEVEL `active_packages` sibling (ApiResponseService merges customData
 * there), so the envelope extends rather than nests.
 */
export interface PackageEnvelope extends Envelope<Package[] | null> {
  active_packages?: Package[]
}

/**
 * The free filter is deliberately catalog-only. `assign_package` is the sole way
 * to take a free package and the CRM does not sell it, so a free card would be
 * unbuyable — but an agent who already holds one must still see it under
 * "current plan".
 */
export function readCatalog(envelope: PackageEnvelope): PackageCatalog {
  return {
    available: (envelope.data ?? []).filter((row) => row.package_type !== 'free'),
    active: envelope.active_packages ?? [],
  }
}

export async function getPackages(signal?: AbortSignal): Promise<PackageCatalog> {
  return readCatalog(await api<PackageEnvelope>('get-package', { signal }))
}

export interface SettingRow {
  type: string
  data: string | null
}

export interface PaymentMethods {
  paypal: boolean
  stripe: boolean
  bank: boolean
  /** Publishable, never secret — get_payment_settings excludes stripe_secret_key. */
  stripeKey: string | null
  stripeCurrency: string
}

/**
 * get_payment_settings answers with `[{type, data}]` ROWS, not an object, and
 * the flags are the strings '1'/'0' straight out of the settings table. Folded
 * once here so no component ever handles a Setting row.
 */
export function paymentMethods(rows: SettingRow[]): PaymentMethods {
  const value = (type: string): string | null =>
    rows.find((row) => row.type === type)?.data ?? null

  return {
    paypal: value('paypal_gateway') === '1',
    stripe: value('stripe_gateway') === '1',
    bank: value('bank_transfer_status') === '1',
    stripeKey: value('stripe_publishable_key'),
    stripeCurrency: value('stripe_currency') ?? 'USD',
  }
}

export async function getPaymentSettings(signal?: AbortSignal): Promise<PaymentMethods> {
  const response = await api<Envelope<SettingRow[] | null>>('get_payment_settings', { signal })
  return paymentMethods(response.data ?? [])
}
