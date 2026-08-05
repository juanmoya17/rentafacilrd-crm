/**
 * Packages and payments for the CRM.
 *
 * These endpoints live OUTSIDE the /api/crm prefix — they are the same ones the
 * Flutter app and the website call, so the shapes mirror ApiController, not the
 * CRM resources. All of them sit under `auth:sanctum`, which the CRM's cookie
 * session already satisfies, so none of this needed backend work.
 */

import { api, ApiError } from '@/lib/api'
import type { Envelope } from './api'
import type { PackageLimit } from './reference'

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

export interface PaymentIntent {
  transactionId: number
  /** PayPal only — the checkout page to open. */
  paypalUrl: string | null
  /** Stripe only — what <Elements> needs. */
  clientSecret: string | null
}

interface IntentPayload {
  payment_intent?: {
    payment_transaction_id?: number
    payment_url?: string
    payment_gateway_response?: { client_secret?: string }
  }
}

/**
 * Writes a new PaymentTransaction row on EVERY call, so callers must create one
 * intent per dialog and disable the button in flight — two clicks are two
 * pending transactions.
 *
 * The refusals (`no paid package found`, `you already have purchased this
 * package`) arrive as {error:true} and api() throws them. The guard below is for
 * the other shape: a 200 that carries no usable gateway field, which would
 * otherwise open `undefined` in a popup.
 */
export async function createPaymentIntent(
  packageId: number,
  method: 'paypal' | 'stripe',
): Promise<PaymentIntent> {
  const response = await api<Envelope<IntentPayload | null>>('create-payment-intent', {
    method: 'POST',
    body: { package_id: packageId, platform_type: 'web', payment_method: method },
  })

  const intent = response.data?.payment_intent
  const transactionId = intent?.payment_transaction_id
  const paypalUrl = intent?.payment_url ?? null
  const clientSecret = intent?.payment_gateway_response?.client_secret ?? null
  const usable = method === 'paypal' ? paypalUrl !== null : clientSecret !== null

  if (transactionId === undefined || !usable) {
    throw new ApiError(response.message ?? 'No se pudo iniciar el pago.', 200, response)
  }

  return { transactionId, paypalUrl, clientSecret }
}

/** Marks an abandoned intent failed so it stops counting as pending. */
export async function failPaymentTransaction(transactionId: number): Promise<void> {
  await api<Envelope<unknown>>('payment-transaction-fail', {
    method: 'POST',
    body: { payment_transaction_id: transactionId },
  })
}

/** Mirrors the server's `mimes:` rule — a hint to the picker, not the check. */
export const RECEIPT_ACCEPT = '.jpg,.jpeg,.png,.pdf,.doc,.docx'
/** The server's `max:6144` is kilobytes. */
export const RECEIPT_MAX_BYTES = 6144 * 1024

const RECEIPT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']

/**
 * Mirror of the server validator so a 20 MB photo fails instantly instead of
 * after the upload. Returns an i18n key suffix, not a message — the caller owns
 * the wording.
 */
export function receiptError(file: File): 'tooLarge' | 'badType' | null {
  if (file.size > RECEIPT_MAX_BYTES) return 'tooLarge'
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return RECEIPT_EXTENSIONS.includes(extension) ? null : 'badType'
}

export async function initiateBankTransfer(packageId: number, file: File): Promise<void> {
  const body = new FormData()
  body.append('package_id', String(packageId))
  body.append('file', file)
  await api<Envelope<unknown>>('initiate-bank-transfer', { method: 'POST', body })
}

/** One `{translated_title, value}` row of the admin's bank details block. */
export interface BankDetail {
  title: string
  translated_title?: string | null
  value: string
}

/**
 * bank_details lives on `web-settings`, NOT `get_system_settings` — that
 * endpoint's type list omits it. Rows arrive already decoded, with
 * translated_title resolved off the Content-Language header api() sends.
 */
export async function getBankDetails(signal?: AbortSignal): Promise<BankDetail[]> {
  const response = await api<Envelope<Record<string, unknown> | null>>('web-settings', { signal })
  const rows = response.data?.bank_details
  return Array.isArray(rows) ? (rows as BankDetail[]) : []
}

export interface PendingTransfer {
  packageName: string
}

interface TransactionRow {
  payment_status?: string
  package?: { name?: string } | null
}

/**
 * A transfer under review has no UserPackage yet, so it never shows up in
 * get-package's active_packages. This is the only way to keep the pending
 * banner alive across a reload — one row, not a history screen.
 *
 * `data` is ABSENT (not empty) when the agent has no transactions at all.
 */
export async function getPendingBankTransfer(
  signal?: AbortSignal,
): Promise<PendingTransfer | null> {
  const query = new URLSearchParams({ payment_type: 'bank transfer', limit: '1' })
  const response = await api<Envelope<TransactionRow[] | undefined>>(
    `get_payment_details?${query.toString()}`,
    { signal },
  )

  const latest = response.data?.[0]
  if (latest?.payment_status !== 'review') return null
  return { packageName: latest.package?.name ?? '' }
}

export type GateReason = 'ok' | 'no-package' | 'limit-reached'

/** Narrowed to the two count-based types the create screens gate on. */
export type GatedFeature = 'property_list' | 'project_list'

/**
 * `feature_available` is deliberately unread. Both gated types are count-based,
 * and PackageType.propertyList in the Flutter app reads exactly this same pair
 * (`checkLimit: true`, not `checkFeature`). Order matters: with no package at
 * all the limit is meaningless, and "buy a plan" is a different instruction
 * from "your quota is spent".
 *
 * Fails closed. reference.ts's checkPackageLimit returns `body.data` unguarded,
 * so a refusal shaped `{error:false, data:null}` arrives here as nullish and
 * must never open the form.
 */
export function gateReason(limits: Partial<PackageLimit> | null | undefined): GateReason {
  if (limits?.package_available !== true) return 'no-package'
  if (limits.limit_available !== true) return 'limit-reached'
  return 'ok'
}
