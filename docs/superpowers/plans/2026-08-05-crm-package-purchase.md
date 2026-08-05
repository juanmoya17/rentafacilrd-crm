# CRM Package Purchase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a CRM agent a `/plan` screen where they can see their current package and buy a new one by bank transfer, PayPal or Stripe — and stop the create screens from asking for a full form the agent has no package to submit.

**Architecture:** A pure data module (`src/lib/crm/packages.ts`) wraps seven existing Laravel endpoints and exposes four pure functions that hold all the decision logic, so every branch is unit-testable under `environment: 'node'`. Three thin React layers sit on top: a `/plan` route, a checkout dialog owning the three payment flows, and a gate component that wraps the two create routes. No backend changes.

**Tech Stack:** React 19, react-router 8, Vite, Vitest, Tailwind 4, `@stripe/stripe-js` + `@stripe/react-stripe-js` (added in Task 7).

## Global Constraints

- **Branch:** `feature/crm-package-purchase` in `rentafacilrd-crm`. Already checked out.
- **Spec:** `docs/superpowers/specs/2026-08-05-crm-package-purchase-design.md`.
- **Tests are `.test.ts` only.** `vite.config.ts` sets `test.include: ['src/**/*.test.ts']` and `environment: 'node'`. A `.test.tsx` file will silently never run. All logic under test must live in plain `.ts`.
- **No `any`.** Use `unknown` and narrow. Project rule, enforced by review.
- **Spanish is the source of truth.** Add every key to `src/lib/i18n/es.ts` first; `en.ts` is typed against it, so a missing English key is a compile error.
- **Import alias is `@/`** → `src/`.
- **`Envelope<T>` and `createdRow<T>()` already exist** and are exported from `src/lib/crm/api.ts`. Do not redeclare `Envelope` — two modules still hold private copies and that is being reduced, not grown.
- **`api()` throws `ApiError` on `{error: true}` or a non-2xx.** It does **not** throw on `{error: false}` with an empty payload — that trap is what commit `ca667ef` fixed, and every new call must guard its own required fields.
- **Server messages are shown verbatim.** Never replace an `ApiError.message` with generic copy.
- **`VITE_API_ORIGIN` defaults to `''`** (dev proxies `/api` same-origin). Any origin comparison must resolve `'' → window.location.origin`.
- **Verify after each task:** `pnpm exec tsc -b && pnpm exec vitest run && pnpm lint` must all pass before committing.

---

### Task 1: Package catalog and payment-method reading

**Files:**
- Create: `src/lib/crm/packages.ts`
- Create: `src/lib/crm/packages.test.ts`

**Interfaces:**
- Consumes: `api` from `@/lib/api`, `Envelope` from `./api`.
- Produces: `PackageFeature`, `Package`, `PackageCatalog`, `PaymentMethods`, `SettingRow`, `readCatalog(envelope)`, `paymentMethods(rows)`, `getPackages(signal?)`, `getPaymentSettings(signal?)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/crm/packages.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/deam/Downloads/RENTA_FACIL/rentafacilrd-crm && pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: FAIL — `Failed to resolve import "./packages"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/crm/packages.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no output from either.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/packages.ts src/lib/crm/packages.test.ts
git commit -m "feat(crm): read the package catalog and enabled payment methods"
```

---

### Task 2: Payment intent, bank transfer, and the pending-transfer read

**Files:**
- Modify: `src/lib/crm/packages.ts` (append)
- Modify: `src/lib/crm/packages.test.ts` (append)

**Interfaces:**
- Consumes: `api`, `ApiError` from `@/lib/api`; `Envelope` from `./api`.
- Produces: `PaymentIntent`, `BankDetail`, `PendingTransfer`, `createPaymentIntent(packageId, method)`, `initiateBankTransfer(packageId, file)`, `failPaymentTransaction(transactionId)`, `getBankDetails(signal?)`, `getPendingBankTransfer(signal?)`, `RECEIPT_ACCEPT`, `RECEIPT_MAX_BYTES`, `receiptError(file)`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/crm/packages.test.ts`:

```ts
import { afterEach, beforeEach, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import {
  createPaymentIntent,
  getPendingBankTransfer,
  receiptError,
  RECEIPT_MAX_BYTES,
} from './packages'

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
    fetchMock.mockResolvedValue(
      jsonResponse({
        error: false,
        message: 'None of payment method is activated',
        data: { payment_intent: { payment_transaction_id: 43 } },
      }),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: FAIL — `createPaymentIntent is not exported`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/crm/packages.ts` (and add `ApiError` to the existing `@/lib/api` import):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/packages.ts src/lib/crm/packages.test.ts
git commit -m "feat(crm): payment intent, bank transfer and pending-transfer reads"
```

---

### Task 3: The package gate decision

**Files:**
- Modify: `src/lib/crm/packages.ts` (append)
- Modify: `src/lib/crm/packages.test.ts` (append)

**Interfaces:**
- Consumes: `api`, `Envelope`.
- Produces: `PackageLimits`, `GateReason`, `gateReason(limits)`, `checkPackageLimit(type, signal?)`, `GatedFeature`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/crm/packages.test.ts`:

```ts
import { gateReason } from './packages'

describe('gateReason()', () => {
  it('opens the form when the package and the limit are both available', () => {
    expect(
      gateReason({ package_available: true, feature_available: false, limit_available: true }),
    ).toBe('ok')
  })

  it('reports no-package first — buying is the only fix', () => {
    expect(
      gateReason({ package_available: false, feature_available: true, limit_available: true }),
    ).toBe('no-package')
  })

  it('reports limit-reached when the plan is live but spent', () => {
    expect(
      gateReason({ package_available: true, feature_available: true, limit_available: false }),
    ).toBe('limit-reached')
  })

  it('ignores feature_available: property_list and project_list are count-based', () => {
    expect(
      gateReason({ package_available: true, feature_available: false, limit_available: true }),
    ).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: FAIL — `gateReason is not exported`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/crm/packages.ts`:

```ts
export interface PackageLimits {
  package_available: boolean
  feature_available: boolean
  limit_available: boolean
}

export type GateReason = 'ok' | 'no-package' | 'limit-reached'

/** The two feature types the CRM's create screens consume. */
export type GatedFeature = 'property_list' | 'project_list'

/**
 * `feature_available` is deliberately unread. Both gated types are count-based,
 * and PackageType.propertyList in the Flutter app reads exactly this same pair
 * (`checkLimit: true`, not `checkFeature`). Order matters: with no package at
 * all the limit is meaningless, and "buy a plan" is a different instruction
 * from "your quota is spent".
 */
export function gateReason(limits: PackageLimits): GateReason {
  if (!limits.package_available) return 'no-package'
  if (!limits.limit_available) return 'limit-reached'
  return 'ok'
}

export async function checkPackageLimit(
  type: GatedFeature,
  signal?: AbortSignal,
): Promise<GateReason> {
  const response = await api<Envelope<Partial<PackageLimits> | null>>(
    `check-package-limit?type=${type}`,
    { signal },
  )

  // Absent flags mean "not granted" — fail closed, never open the form on a
  // shape we did not recognise.
  return gateReason({
    package_available: response.data?.package_available === true,
    feature_available: response.data?.feature_available === true,
    limit_available: response.data?.limit_available === true,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/crm/packages.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/packages.ts src/lib/crm/packages.test.ts
git commit -m "feat(crm): package gate decision for the create screens"
```

---

### Task 4: The PayPal popup channel

**Files:**
- Create: `src/lib/crm/payment-popup.ts`
- Create: `src/lib/crm/payment-popup.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `apiOrigin()`, `isTrustedPaymentMessage(event)`, `openCentered(url, title)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/crm/payment-popup.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/crm/payment-popup.test.ts`
Expected: FAIL — `Failed to resolve import "./payment-popup"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/crm/payment-popup.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/crm/payment-popup.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/payment-popup.ts src/lib/crm/payment-popup.test.ts
git commit -m "feat(crm): origin-checked PayPal popup channel"
```

---

### Task 5: Translation keys

**Files:**
- Modify: `src/lib/i18n/es.ts`
- Modify: `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `plan.*` and `nav.plan` keys every later task calls through `t()`.

Doing all keys in one task is deliberate: `TranslationKey` is derived from `es.ts`, so `en.ts` fails to compile the moment the two drift. One add, one compile check.

- [ ] **Step 1: Add the Spanish keys**

In `src/lib/i18n/es.ts`, add `'nav.plan': 'Plan',` immediately after the `'nav.notifications'` entry, then append this block before the closing `} as const`:

```ts
  'plan.title': 'Plan y facturación',
  'plan.subtitle': 'Tu paquete actual y los planes disponibles.',
  'plan.current': 'Plan actual',
  'plan.none': 'No tienes ningún plan activo.',
  'plan.noneHint': 'Elige uno abajo para empezar a publicar.',
  'plan.available': 'Planes disponibles',
  'plan.empty': 'No hay planes disponibles para tu cuenta.',
  'plan.until': 'Vence el {date}',
  'plan.unlimited': 'Ilimitado',
  'plan.usage': '{used} de {total}',
  'plan.buy': 'Contratar',
  'plan.pendingTransfer': 'Tu transferencia para {package} está en revisión.',
  'plan.pendingTransferHint': 'Se activará cuando un administrador la apruebe.',
  'plan.loading': 'Cargando planes…',
  'plan.retry': 'Reintentar',

  'checkout.title': 'Contratar {package}',
  'checkout.close': 'Cerrar',
  'checkout.method': 'Elige cómo pagar',
  'checkout.noMethods': 'No hay métodos de pago activos. Contacta con soporte.',
  'checkout.bank': 'Transferencia bancaria',
  'checkout.paypal': 'PayPal',
  'checkout.stripe': 'Tarjeta',
  'checkout.back': 'Volver',
  'checkout.pay': 'Pagar',
  'checkout.paying': 'Procesando…',

  'checkout.bankTitle': 'Datos para la transferencia',
  'checkout.bankReceipt': 'Comprobante',
  'checkout.bankReceiptHelper': 'JPG, PNG, PDF o Word. Máximo 6 MB.',
  'checkout.bankSend': 'Enviar comprobante',
  'checkout.bankSent': 'Comprobante recibido. Un administrador lo revisará.',
  'checkout.receipt.tooLarge': 'El archivo supera los 6 MB.',
  'checkout.receipt.badType': 'Formato no admitido. Usa JPG, PNG, PDF o Word.',

  'checkout.popupBlocked': 'Tu navegador bloqueó la ventana de PayPal.',
  'checkout.popupOpen': 'Abrir PayPal',
  'checkout.paypalWaiting': 'Completa el pago en la ventana de PayPal.',

  'gate.noPackage': 'Necesitas un plan activo',
  'gate.noPackageHint': 'Contrata un plan para poder publicar.',
  'gate.limitReached': 'Alcanzaste el límite de tu plan',
  'gate.limitReachedHint': 'Mejora tu plan para seguir publicando.',
  'gate.seePlans': 'Ver planes',
  'gate.checking': 'Comprobando tu plan…',
```

- [ ] **Step 2: Run the typecheck to see en.ts fail**

Run: `pnpm exec tsc -b`
Expected: FAIL — `en.ts` is missing the new keys.

- [ ] **Step 3: Add the English keys**

Add the same key set to `src/lib/i18n/en.ts`, in the same positions:

```ts
  'nav.plan': 'Plan',

  'plan.title': 'Plan & billing',
  'plan.subtitle': 'Your current package and the plans available to you.',
  'plan.current': 'Current plan',
  'plan.none': "You don't have an active plan.",
  'plan.noneHint': 'Pick one below to start publishing.',
  'plan.available': 'Available plans',
  'plan.empty': 'No plans are available for your account.',
  'plan.until': 'Expires {date}',
  'plan.unlimited': 'Unlimited',
  'plan.usage': '{used} of {total}',
  'plan.buy': 'Subscribe',
  'plan.pendingTransfer': 'Your transfer for {package} is under review.',
  'plan.pendingTransferHint': 'It activates once an administrator approves it.',
  'plan.loading': 'Loading plans…',
  'plan.retry': 'Retry',

  'checkout.title': 'Subscribe to {package}',
  'checkout.close': 'Close',
  'checkout.method': 'Choose how to pay',
  'checkout.noMethods': 'No payment methods are active. Contact support.',
  'checkout.bank': 'Bank transfer',
  'checkout.paypal': 'PayPal',
  'checkout.stripe': 'Card',
  'checkout.back': 'Back',
  'checkout.pay': 'Pay',
  'checkout.paying': 'Processing…',

  'checkout.bankTitle': 'Transfer details',
  'checkout.bankReceipt': 'Receipt',
  'checkout.bankReceiptHelper': 'JPG, PNG, PDF or Word. 6 MB maximum.',
  'checkout.bankSend': 'Send receipt',
  'checkout.bankSent': 'Receipt received. An administrator will review it.',
  'checkout.receipt.tooLarge': 'That file is over 6 MB.',
  'checkout.receipt.badType': 'Unsupported format. Use JPG, PNG, PDF or Word.',

  'checkout.popupBlocked': 'Your browser blocked the PayPal window.',
  'checkout.popupOpen': 'Open PayPal',
  'checkout.paypalWaiting': 'Finish the payment in the PayPal window.',

  'gate.noPackage': 'You need an active plan',
  'gate.noPackageHint': 'Subscribe to a plan to publish.',
  'gate.limitReached': "You've hit your plan's limit",
  'gate.limitReachedHint': 'Upgrade your plan to keep publishing.',
  'gate.seePlans': 'See plans',
  'gate.checking': 'Checking your plan…',
```

- [ ] **Step 4: Verify both locales compile and the i18n test still passes**

Run: `pnpm exec tsc -b && pnpm exec vitest run src/lib/i18n/i18n.test.ts`
Expected: no tsc output, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/es.ts src/lib/i18n/en.ts
git commit -m "feat(crm): translation keys for plan, checkout and the package gate"
```

---

### Task 6: The `/plan` route

**Files:**
- Create: `src/routes/plan.tsx`
- Modify: `src/main.tsx`
- Modify: `src/components/crm-layout.tsx`

**Interfaces:**
- Consumes: `getPackages`, `getPendingBankTransfer`, `Package`, `PackageFeature` from `@/lib/crm/packages`; `useResource`; `useI18n`; `Badge`, `Button`, `Card`, `EmptyState`, `ErrorState`, `LoadingState`, `PageHeader` from `@/components/ui`; `RecordSectionHead` from `@/components/record`.
- Produces: `PlanPage`, and the `/plan` route the gate links to. Renders `<CheckoutDialog>` from Task 8 — until that task lands, the buy button is wired to a `selected` state that renders nothing.

- [ ] **Step 1: Write the page**

Create `src/routes/plan.tsx`:

```tsx
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { RecordSectionHead } from '@/components/record'
import { useResource } from '@/lib/use-resource'
import { getPackages, getPendingBankTransfer, type Package, type PackageFeature } from '@/lib/crm/packages'

/**
 * Plan and billing.
 *
 * The usage rows are the reason this is not just a pricing page: an agent who
 * cannot publish needs to see WHICH quota is spent, and get-package already
 * carries used/total per feature on the packages they hold.
 */
export function PlanPage() {
  const { t, formatCurrency, formatDate } = useI18n()
  const catalog = useResource((signal) => getPackages(signal), [])
  const pending = useResource((signal) => getPendingBankTransfer(signal), [])
  const [selected, setSelected] = useState<Package | null>(null)

  if (catalog.status === 'loading') return <LoadingState label={t('plan.loading')} />
  if (catalog.status === 'error') {
    return (
      <ErrorState
        message={catalog.message}
        retryLabel={t('plan.retry')}
        onRetry={catalog.reload}
      />
    )
  }

  const { active, available } = catalog.data

  const usage = (feature: PackageFeature): string => {
    if (feature.limit_type === 'unlimited') return t('plan.unlimited')
    return t('plan.usage', {
      used: feature.used_limit ?? 0,
      total: feature.total_limit ?? feature.limit ?? 0,
    })
  }

  return (
    <>
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />

      {pending.status === 'ready' && pending.data !== null && (
        <Card className="mt-4 p-4" role="status">
          <p className="text-sm font-medium text-ink">
            {t('plan.pendingTransfer', { package: pending.data.packageName })}
          </p>
          <p className="mt-1 text-sm text-ink-2">{t('plan.pendingTransferHint')}</p>
        </Card>
      )}

      <div className="mt-6 grid gap-6">
        <section>
          <RecordSectionHead label={t('plan.current')} />
          {active.length === 0 ? (
            <EmptyState title={t('plan.none')} hint={t('plan.noneHint')} />
          ) : (
            <div className="grid gap-3">
              {active.map((pkg) => (
                <Card key={pkg.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">
                      {pkg.translated_name ?? pkg.name}
                    </h3>
                    {pkg.end_date != null && pkg.end_date !== '' && (
                      <Badge tone="neutral">{t('plan.until', { date: formatDate(pkg.end_date) })}</Badge>
                    )}
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {pkg.features.map((feature) => (
                      <li key={feature.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-ink-2">{feature.translated_name ?? feature.name}</span>
                        <span className="font-mono text-xs text-muted">{usage(feature)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <RecordSectionHead label={t('plan.available')} />
          {available.length === 0 ? (
            <EmptyState title={t('plan.empty')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {available.map((pkg) => (
                <Card key={pkg.id} className="flex flex-col gap-3 p-4">
                  <h3 className="text-sm font-semibold text-ink">
                    {pkg.translated_name ?? pkg.name}
                  </h3>
                  <p className="text-lg font-semibold text-ink">
                    {formatCurrency(pkg.effective_price)}
                  </p>
                  <ul className="grid gap-1 text-sm text-ink-2">
                    {pkg.features.map((feature) => (
                      <li key={feature.id}>{feature.translated_name ?? feature.name}</li>
                    ))}
                  </ul>
                  <Button variant="primary" onClick={() => setSelected(pkg)} className="mt-auto">
                    {t('plan.buy')}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Task 8 replaces this with <CheckoutDialog>. */}
      {selected !== null && null}
    </>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/main.tsx`, add the import alongside the other route imports and the route entry after `/notifications`:

```tsx
import { PlanPage } from '@/routes/plan'
```

```tsx
          { path: '/plan', element: <PlanPage /> },
```

- [ ] **Step 3: Add the nav entry**

In `src/components/crm-layout.tsx`, add `CreditCard` to the `lucide-react` import, then add this item to the `nav.section.system` group, above the Settings entry:

```tsx
      { to: '/plan', label: 'nav.plan', icon: CreditCard },
```

- [ ] **Step 4: Verify it compiles, lints and the suite still passes**

Run: `pnpm exec tsc -b && pnpm lint && pnpm exec vitest run`
Expected: no tsc/lint output; all tests PASS.

- [ ] **Step 5: Check it renders**

Run: `pnpm dev`, sign in, open `/plan`. Expect the current plan (or the empty state) and the catalog. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/routes/plan.tsx src/main.tsx src/components/crm-layout.tsx
git commit -m "feat(crm): plan and billing screen with current usage"
```

---

### Task 7: Stripe payment component

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `src/components/stripe-payment.tsx`

**Interfaces:**
- Consumes: `failPaymentTransaction` from `@/lib/crm/packages`.
- Produces: `<StripePayment publishableKey clientSecret onPaid />`. Releasing an abandoned transaction stays with the dialog (Task 8), which owns the intent for all three methods.

> **Gate:** installing the two dependencies needs Damian's explicit go-ahead (project rule: ask before installing packages). Confirm before Step 1.

- [ ] **Step 1: Install the dependencies**

```bash
cd /Users/deam/Downloads/RENTA_FACIL/rentafacilrd-crm
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 2: Write the component**

Create `src/components/stripe-payment.tsx`:

```tsx
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useI18n } from '@/lib/i18n/context'
import { Button } from '@/components/ui'

/**
 * Stripe's JS must come from js.stripe.com and can never be bundled, which is
 * what loadStripe() exists for. Cached per publishable key so re-opening the
 * dialog does not re-fetch the script.
 */
const stripeCache = new Map<string, ReturnType<typeof loadStripe>>()

function stripeFor(publishableKey: string): ReturnType<typeof loadStripe> {
  const cached = stripeCache.get(publishableKey)
  if (cached !== undefined) return cached
  const created = loadStripe(publishableKey)
  stripeCache.set(publishableKey, created)
  return created
}

function CardForm({ onPaid }: { onPaid: () => void }) {
  const { t } = useI18n()
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const submit = async () => {
    if (stripe === null || elements === null) return
    setPaying(true)
    setError(null)

    // 'if_required' keeps a card that needs no 3DS inside the SPA; only a
    // challenge sends the agent to return_url and back.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/plan` },
      redirect: 'if_required',
    })

    if (result.error !== undefined) {
      // Stripe's own wording names the actual decline reason.
      setError(result.error.message ?? t('error.generic'))
      setPaying(false)
      // The transaction stays pending server-side until the agent retries or
      // closes; only an abandoned dialog marks it failed.
      return
    }

    onPaid()
  }

  return (
    <div className="grid gap-3">
      <PaymentElement />
      {error !== null && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        state={paying ? 'loading' : 'idle'}
        onClick={() => void submit()}
      >
        {t(paying ? 'checkout.paying' : 'checkout.pay')}
      </Button>
    </div>
  )
}

export function StripePayment({
  publishableKey,
  clientSecret,
  onPaid,
}: {
  publishableKey: string
  clientSecret: string
  onPaid: () => void
}) {
  return (
    <Elements stripe={stripeFor(publishableKey)} options={{ clientSecret }}>
      <CardForm onPaid={onPaid} />
    </Elements>
  )
}
```

Releasing an abandoned transaction is the dialog's job, not this component's —
it owns the intent for all three methods — so `failPaymentTransaction` is
imported there, and this file's import of it is dropped.

- [ ] **Step 3: Verify it compiles and lints**

Run: `pnpm exec tsc -b && pnpm lint && pnpm exec vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/stripe-payment.tsx
git commit -m "feat(crm): Stripe Elements payment component"
```

---

### Task 8: Checkout dialog

**Files:**
- Create: `src/components/checkout-dialog.tsx`
- Modify: `src/routes/plan.tsx` (replaces the `{selected !== null && null}` placeholder left by Task 6)

**Interfaces:**
- Consumes: `Package`, `PaymentMethods`, `getPaymentSettings`, `getBankDetails`, `createPaymentIntent`, `initiateBankTransfer`, `failPaymentTransaction`, `receiptError`, `RECEIPT_ACCEPT` from `@/lib/crm/packages`; `apiOrigin`, `isTrustedPaymentMessage`, `openCentered` from `@/lib/crm/payment-popup`; `StripePayment`, `abandonStripePayment` from `@/components/stripe-payment`.
- Produces: `<CheckoutDialog pkg onClose onPurchased />`.

- [ ] **Step 1: Write the dialog**

Create `src/components/checkout-dialog.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { Button, FileField, LoadingState, Modal } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { ApiError } from '@/lib/api'
import {
  RECEIPT_ACCEPT,
  createPaymentIntent,
  failPaymentTransaction,
  getBankDetails,
  getPaymentSettings,
  initiateBankTransfer,
  receiptError,
  type Package,
} from '@/lib/crm/packages'
import { apiOrigin, isTrustedPaymentMessage, openCentered } from '@/lib/crm/payment-popup'
import { StripePayment } from '@/components/stripe-payment'

type Screen =
  | { kind: 'methods' }
  | { kind: 'bank' }
  | { kind: 'bank-sent' }
  | { kind: 'paypal'; blockedUrl: string | null }
  | { kind: 'stripe'; clientSecret: string; transactionId: number; publishableKey: string }

export function CheckoutDialog({
  pkg,
  onClose,
  onPurchased,
}: {
  pkg: Package
  onClose: () => void
  onPurchased: () => void
}) {
  const { t } = useI18n()
  const settings = useResource((signal) => getPaymentSettings(signal), [])
  const [screen, setScreen] = useState<Screen>({ kind: 'methods' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Set once an intent exists, so closing can mark it failed. */
  const openTransaction = useRef<number | null>(null)
  const paypalWindow = useRef<Window | null>(null)

  // Closing without paying releases the pending transaction. Runs on unmount,
  // which is how every dismissal here ends.
  useEffect(() => {
    return () => {
      const id = openTransaction.current
      if (id !== null) void failPaymentTransaction(id)
    }
  }, [])

  const start = async (method: 'paypal' | 'stripe') => {
    if (busy) return // one intent per dialog: each call writes a PaymentTransaction
    setBusy(true)
    setError(null)
    try {
      const intent = await createPaymentIntent(pkg.id, method)
      openTransaction.current = intent.transactionId

      if (method === 'stripe') {
        const key = settings.status === 'ready' ? settings.data.stripeKey : null
        if (key === null || intent.clientSecret === null) {
          setError(t('checkout.noMethods'))
          return
        }
        setScreen({
          kind: 'stripe',
          clientSecret: intent.clientSecret,
          transactionId: intent.transactionId,
          publishableKey: key,
        })
        return
      }

      const url = intent.paypalUrl ?? ''
      const popup = openCentered(url, 'PayPal')
      paypalWindow.current = popup
      // No same-tab fallback: paypal.blade.php calls window.opener.postMessage,
      // and a same-tab redirect has no opener — the agent would land on a blank
      // page. Offer the link instead, which reopens with a user gesture.
      setScreen({ kind: 'paypal', blockedUrl: popup === null ? url : null })
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  // PayPal returns through a postMessage from the API origin. Treated only as
  // "go refetch" — never as proof of payment.
  useEffect(() => {
    if (screen.kind !== 'paypal') return
    const trusted = apiOrigin()

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedPaymentMessage({ origin: event.origin, data: event.data }, trusted)) return
      openTransaction.current = null
      onPurchased()
    }

    window.addEventListener('message', onMessage)

    // An agent who closes the PayPal window without paying sends no message and
    // would otherwise sit on "finish the payment" forever. Poll for it and fall
    // back to the method list, where they can pick again.
    const poll = window.setInterval(() => {
      if (paypalWindow.current?.closed !== true) return
      window.clearInterval(poll)
      paypalWindow.current = null
      setScreen({ kind: 'methods' })
    }, 500)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(poll)
    }
  }, [screen.kind, onPurchased])

  const body = () => {
    if (settings.status === 'loading') return <LoadingState label={t('plan.loading')} />
    if (settings.status === 'error') {
      return (
        <p role="alert" className="text-sm text-error">
          {settings.message}
        </p>
      )
    }

    const methods = settings.data

    if (screen.kind === 'stripe') {
      return (
        <StripePayment
          publishableKey={screen.publishableKey}
          clientSecret={screen.clientSecret}
          transactionId={screen.transactionId}
          onPaid={() => {
            openTransaction.current = null
            onPurchased()
          }}
        />
      )
    }

    if (screen.kind === 'paypal') {
      return (
        <div className="grid gap-3">
          <p className="text-sm text-ink-2">{t('checkout.paypalWaiting')}</p>
          {screen.blockedUrl !== null && (
            <>
              <p role="alert" className="text-sm text-error">
                {t('checkout.popupBlocked')}
              </p>
              <a
                href={screen.blockedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent underline"
              >
                {t('checkout.popupOpen')}
              </a>
            </>
          )}
        </div>
      )
    }

    if (screen.kind === 'bank-sent') {
      return (
        <p role="status" className="text-sm text-ink-2">
          {t('checkout.bankSent')}
        </p>
      )
    }

    if (screen.kind === 'bank') return <BankPanel pkg={pkg} onSent={() => setScreen({ kind: 'bank-sent' })} />

    const anyMethod = methods.bank || methods.paypal || methods.stripe
    if (!anyMethod) {
      return (
        <p role="alert" className="text-sm text-error">
          {t('checkout.noMethods')}
        </p>
      )
    }

    return (
      <div className="grid gap-2">
        <p className="text-sm text-ink-2">{t('checkout.method')}</p>
        {methods.bank && (
          <Button onClick={() => setScreen({ kind: 'bank' })}>{t('checkout.bank')}</Button>
        )}
        {methods.paypal && (
          <Button state={busy ? 'loading' : 'idle'} onClick={() => void start('paypal')}>
            {t('checkout.paypal')}
          </Button>
        )}
        {methods.stripe && (
          <Button state={busy ? 'loading' : 'idle'} onClick={() => void start('stripe')}>
            {t('checkout.stripe')}
          </Button>
        )}
        {error !== null && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Modal
      title={t('checkout.title', { package: pkg.translated_name ?? pkg.name })}
      closeLabel={t('checkout.close')}
      onClose={onClose}
    >
      {body()}
    </Modal>
  )
}

function BankPanel({ pkg, onSent }: { pkg: Package; onSent: () => void }) {
  const { t } = useI18n()
  // Lazy on purpose: web-settings returns every public setting the platform
  // has, and only this panel needs it.
  const details = useResource((signal) => getBankDetails(signal), [])
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const send = async () => {
    const file = files[0]
    if (file === undefined) return

    const problem = receiptError(file)
    if (problem !== null) {
      setError(t(problem === 'tooLarge' ? 'checkout.receipt.tooLarge' : 'checkout.receipt.badType'))
      return
    }

    setSending(true)
    setError(null)
    try {
      await initiateBankTransfer(pkg.id, file)
      onSent()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('error.generic'))
      setSending(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-ink">{t('checkout.bankTitle')}</p>
      {details.status === 'ready' && (
        <dl className="grid gap-1.5">
          {details.data.map((row) => (
            <div key={row.title} className="flex justify-between gap-3 text-sm">
              <dt className="text-ink-2">{row.translated_title ?? row.title}</dt>
              <dd className="font-mono text-xs text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <FileField
        id="bank-receipt"
        label={t('checkout.bankReceipt')}
        accept={RECEIPT_ACCEPT}
        files={files}
        onChange={setFiles}
        helper={t('checkout.bankReceiptHelper')}
        error={error ?? undefined}
        state={error !== null ? 'error' : 'idle'}
        required
      />

      <Button
        variant="primary"
        state={sending ? 'loading' : 'idle'}
        disabled={files.length === 0}
        onClick={() => void send()}
      >
        {t('checkout.bankSend')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the plan page**

In `src/routes/plan.tsx`, add the import and replace the Task 6 placeholder:

```tsx
import { CheckoutDialog } from '@/components/checkout-dialog'
```

```tsx
      {selected !== null && (
        <CheckoutDialog
          pkg={selected}
          onClose={() => setSelected(null)}
          onPurchased={() => {
            setSelected(null)
            catalog.reload()
            pending.reload()
          }}
        />
      )}
```

- [ ] **Step 3: Verify it compiles, lints and the suite passes**

Run: `pnpm exec tsc -b && pnpm lint && pnpm exec vitest run`
Expected: clean.

- [ ] **Step 4: Manual check of the bank path**

Run `pnpm dev`, open `/plan`, click a plan, pick the bank transfer method. Confirm the details render, a `.heic` file is rejected client-side, and a small PDF submits to the "under review" state. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/components/checkout-dialog.tsx src/routes/plan.tsx
git commit -m "feat(crm): checkout dialog for bank transfer, PayPal and Stripe"
```

---

### Task 9: The up-front package gate

**Files:**
- Create: `src/components/plan-gate.tsx`
- Modify: `src/routes/property-new.tsx`
- Modify: `src/routes/project-new.tsx`

**Interfaces:**
- Consumes: `checkPackageLimit`, `type GatedFeature` from `@/lib/crm/packages`; `useResource`; `EmptyState`, `LinkButton`, `LoadingState`, `ErrorState` from `@/components/ui`.
- Produces: `<PlanGate feature>{children}</PlanGate>`.

- [ ] **Step 1: Write the gate**

Create `src/components/plan-gate.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState, ErrorState, LinkButton, LoadingState } from '@/components/ui'
import { useResource } from '@/lib/use-resource'
import { checkPackageLimit, type GatedFeature } from '@/lib/crm/packages'

/**
 * Refuse before the form, not after it.
 *
 * The Flutter app already does this at main_activity.dart — it checks
 * check-package-limit before opening the add flow. Without it the CRM lets an
 * agent fill nine fields and upload a cover before the server refuses, which is
 * the complaint that started this work. The submit-time error stays as the
 * backstop for a plan that expires mid-form.
 */
export function PlanGate({
  feature,
  children,
}: {
  feature: GatedFeature
  children: ReactNode
}) {
  const { t } = useI18n()
  const gate = useResource((signal) => checkPackageLimit(feature, signal), [feature])

  if (gate.status === 'loading') return <LoadingState label={t('gate.checking')} />
  if (gate.status === 'error') {
    return <ErrorState message={gate.message} retryLabel={t('plan.retry')} onRetry={gate.reload} />
  }
  if (gate.data === 'ok') return <>{children}</>

  const noPackage = gate.data === 'no-package'
  return (
    <EmptyState
      title={t(noPackage ? 'gate.noPackage' : 'gate.limitReached')}
      hint={t(noPackage ? 'gate.noPackageHint' : 'gate.limitReachedHint')}
      action={<LinkButton to="/plan">{t('gate.seePlans')}</LinkButton>}
    />
  )
}
```

- [ ] **Step 2: Wrap the project create page**

In `src/routes/project-new.tsx`, add the import, rename the existing component to `ProjectNewForm`, and export a wrapper:

```tsx
import { PlanGate } from '@/components/plan-gate'
```

```tsx
export function ProjectNewPage() {
  return (
    <PlanGate feature="project_list">
      <ProjectNewForm />
    </PlanGate>
  )
}
```

- [ ] **Step 3: Wrap the property create page the same way**

In `src/routes/property-new.tsx`, rename the existing component to `PropertyNewForm` and export:

```tsx
export function PropertyNewPage() {
  return (
    <PlanGate feature="property_list">
      <PropertyNewForm />
    </PlanGate>
  )
}
```

- [ ] **Step 4: Add the plans link to both submit-time error banners**

In `src/routes/project-new.tsx`, replace the error paragraph:

```tsx
        {error !== null && (
          <div role="alert" className="grid gap-1">
            <p className="text-xs text-error">{error}</p>
            <LinkButton to="/plan">{t('gate.seePlans')}</LinkButton>
          </div>
        )}
```

Apply the same replacement to the equivalent block in `src/routes/property-new.tsx`, adding `LinkButton` to each file's `@/components/ui` import.

- [ ] **Step 5: Verify everything compiles, lints and passes**

Run: `pnpm exec tsc -b && pnpm lint && pnpm exec vitest run`
Expected: clean, 24 tests.

- [ ] **Step 6: Manual check**

Run `pnpm dev`. With no active package, `/properties/new` and `/projects/new` show the gate panel and its CTA lands on `/plan`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/components/plan-gate.tsx src/routes/property-new.tsx src/routes/project-new.tsx
git commit -m "feat(crm): gate the create screens on an active package"
```

---

## Notes for the implementer

- **Task 7 is blocked on approval** for the two Stripe dependencies. Tasks 1–6 and 9 do not depend on it; if approval is pending, do Task 8 with the Stripe branch stubbed to show `checkout.noMethods` and return to it.
- **One file more than the spec's table.** The spec listed five new files; this plan adds a sixth, `src/lib/crm/payment-popup.ts`. The origin check has to be unit-testable, and `vite.config.ts` only collects `.test.ts` — logic left inside the `.tsx` dialog would never be covered. The security-critical branch earns its own module.
- **Manual QA that no test covers:** Stripe test cards (`4242…` for the happy path, `4000 0025 0000 3155` for a 3DS challenge), a real PayPal sandbox round-trip, and the popup-blocked path (block popups in the browser, confirm the manual link appears).
