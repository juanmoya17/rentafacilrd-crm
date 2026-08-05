# CRM package purchase

**Date:** 2026-08-05
**Status:** Approved, ready for planning
**Repo:** `rentafacilrd-crm`

## Problem

An agent working in the CRM cannot buy a package. Every write the platform gates
on an active package — creating a listing, creating a project — refuses them, and
until now it refused them silently: `HelperService::updatePackageLimit()` halts
with a *success* envelope (`{error:false, message:"No active package found…",
data:null}` at HTTP 200), which the CRM read as "created, no id returned" and
navigated away from. Commit `ca667ef` made that refusal visible. This spec gives
the agent somewhere to go once they see it.

The app and the website both have a purchase surface. The CRM has none, and no
nav entry, route, or dependency for one.

## How the other surfaces do it

All three clients drive the same Laravel endpoints in `rentalfacilrdpanel`.

| Endpoint | Purpose |
|---|---|
| `get-package` | Catalog, audience-filtered: `verification_status === 'verified_agent'` sees `target_user: 'agent'` packages. Returns the caller's own plans in a top-level `active_packages` sibling, with live `used_limit` / `total_limit` per feature. |
| `get_payment_settings` | Gateway enable flags (`paypal_gateway`, `stripe_gateway`, `bank_transfer_status`), the Stripe **publishable** key and currency. Secrets are excluded server-side. |
| `create-payment-intent` | `package_id` + `platform_type: 'app'\|'web'` + optional `payment_method: 'paypal'\|'stripe'`. Refuses free packages, packages already held, and packages outside the caller's audience. Converts DOP→USD when PayPal is configured for USD. |
| `initiate-bank-transfer` | `package_id` + receipt `file`. Creates a transaction with `payment_status: 'review'` for an admin to approve. |
| `payment-transaction-fail` | Marks an abandoned intent failed. |
| `check-package-limit` | `{package_available, feature_available, limit_available}` for a feature type. |
| `get_payment_details` | The caller's transactions, filterable by `payment_type` and paginated. Returns **no `data` key at all** when there are none. |
| `web-settings` | Public settings map. Carries `bank_details` as an **already-decoded array** of `{title, value, translated_title}`, localised off `Content-Language` (which the CRM already sends). Not `get_system_settings` — that endpoint's type list omits `bank_details` entirely. |

`payment_method` is validated `in:paypal,stripe`. The Razorpay / Paystack /
Flutterwave handlers in the website are dead eBroker inventory and are not
carried into the CRM.

**App** (`packages_list.dart`): iOS purchases through RevenueCat; Android shows
one button per enabled gateway plus a bank-transfer sheet.

**Website** (`PaymentHandlers.jsx`): Stripe renders `<Elements>` from the
`client_secret`; PayPal opens `payment_url` in a centered popup and waits for the
`window.opener.postMessage` that `resources/views/payments/responses/paypal.blade.php`
fires on return; cancelling calls `payment-transaction-fail`.

All the endpoints sit under `auth:sanctum`, which the CRM's existing cookie
session already satisfies. **No backend work is required.**

## Scope

**In:** a `/plan` billing surface showing the current plan with per-feature usage
and the purchasable catalog; checkout by bank transfer, PayPal and Stripe; an
up-front package gate on the two create screens.

**Out:** free-package activation via `assign_package`; a full transaction-history
screen; RevenueCat; the three dead gateways.

**Stated assumption:** free packages are filtered out of the catalog. `assign_package`
is the only way to take one and it is out of scope, so a free card would be
unbuyable. If free agent tiers exist and should be offered, that decision reopens.

## Architecture

One new route `/plan` inside the existing `RequireAuth` → `CrmLayout` tree, and
one nav entry in the `system` section above Settings (`CreditCard`, `nav.plan`).
Billing is not an inventory concern, and burying it in Settings would make the
paywall CTA a two-hop journey.

| File | Responsibility |
|---|---|
| `src/lib/crm/packages.ts` | Types and the eight calls: `getPackages`, `getPaymentSettings`, `getBankDetails`, `createPaymentIntent`, `initiateBankTransfer`, `failPaymentTransaction`, `checkPackageLimit`, `getPendingBankTransfer`. No React. |
| `src/routes/plan.tsx` | Current plan + usage, then the catalog. |
| `src/components/checkout-dialog.tsx` | Method picker and the three flows. |
| `src/components/stripe-payment.tsx` | `<Elements>` wrapper. |
| `src/components/plan-gate.tsx` | Up-front gate, reused by both create screens. |

Modified: `src/main.tsx` (route), `src/components/crm-layout.tsx` (nav),
`src/routes/property-new.tsx` and `src/routes/project-new.tsx` (gate + a link to
`/plan` on the existing error banner), `src/lib/i18n/es.ts` and `en.ts`.

### Data layer

`packages.ts` wraps `api()` the same way `crm/api.ts` does and is consumed through
the existing `useResource` hook. Two response shapes need pinning down:

- `get-package` puts the catalog in `data` but the agent's own plans in a
  **top-level** `active_packages` sibling, so the envelope type extends rather
  than nests:
  `interface PackageEnvelope extends Envelope<Package[]> { active_packages?: Package[] }`.
- `get_payment_settings` answers with `[{type, data}]` **rows**, not an object.
  `packages.ts` folds them once into
  `{ paypal: boolean; stripe: boolean; bank: boolean; stripeKey: string | null; stripeCurrency: string }`
  so no component ever handles a `Setting` row.

`used_limit` and `total_limit` arrive per feature on active packages, so the usage
display needs no extra call.

The free-package filter belongs to the **catalog only**. An agent who holds a free
plan must still see it under "current plan", so `readCatalog` filters
`envelope.data` and passes `active_packages` through untouched.

## Flows

### Catalog

`/plan` renders the active plan with a usage row per feature (`used_limit / total_limit`,
"Ilimitado" when `limit_type` is `unlimited`), then the purchasable catalog with
free packages filtered out. Clicking a package opens the checkout dialog, which
lists only the methods the server reports as enabled. If all three are disabled
the dialog says so rather than rendering an empty list.

### Bank transfer

A panel with the bank details and a receipt `FileField`. Details come from
`web-settings` → `bank_details`, fetched **lazily** only when this method is
picked — that endpoint returns every public setting the platform has and should
not load on page open. Rows arrive decoded, with `translated_title` already
resolved for the active locale, so the panel renders `translated_title` / `value`
pairs directly. The client mirrors the server validator (jpeg/png/jpg/pdf/doc/docx,
≤ 6 MB) so an oversized file fails before the upload rather than after it. On
submit, `initiate-bank-transfer` lands the transaction in `review` and the panel
says so.

`/plan` keeps showing that pending state across reloads, which `get-package`
cannot supply: a transfer under review has no `UserPackage` yet, so it never
appears in `active_packages`. One call to
`get_payment_details?payment_type=bank transfer&limit=1` gives the latest
transfer, and a `payment_status` of `review` renders a banner naming the package.
That is one banner, not the transaction-history screen ruled out under Scope.
The call must tolerate a **missing `data` key** — that endpoint omits it entirely
when the agent has no transactions.

### PayPal

`create-payment-intent` with `platform_type: 'web'`, `payment_method: 'paypal'` →
`payment_intent.payment_url` → centered popup. A `message` listener verifies
`event.origin` against `VITE_API_ORIGIN` and treats the message **only** as a
signal to refetch — the grant is the server's, never the message's. A
`popup.closed` poll tears the listener down if the agent abandons it.

The website's blocked-popup fallback is deliberately **not** copied: it redirects
the same tab, but `paypal.blade.php` calls `window.opener.postMessage` and there
is no opener on that path, so the user lands on a blank page. The CRM shows an
"allow popups" message plus a manual link. (That is a live website bug; out of
scope here, worth its own ticket.)

### Stripe

Same intent call with `payment_method: 'stripe'` → `client_secret` →
`<Elements>` + `<PaymentElement>`, confirmed with `redirect: 'if_required'` so a
card that needs no 3DS never leaves the SPA. Dismissing the dialog without paying
calls `payment-transaction-fail`, matching the app and the website.

After any success the plan page reloads through `useResource.reload()`.

### The gate

`plan-gate.tsx` wraps `/properties/new` and `/projects/new`. On mount it calls
`check-package-limit` for `property_list` / `project_list` and renders the form
only when the package **and** the limit are available. `feature_available` is
ignored for these two: both are count-based types, and `PackageType.propertyList`
in the app reads exactly the same pair. Otherwise it renders a panel whose copy is
driven by which boolean failed — "no plan" links to `/plan`, "limit reached" says
the quota is spent — because those need different actions from the agent. The submit-time error banner added in `ca667ef` stays as the
backstop and gains the same link.

## Error handling

`api()` already converts `error: true` into an `ApiError`, and every package
endpoint uses `validationError` for refusals, so the success-envelope trap that
motivated `ca667ef` does not apply here. The lesson does: `create-payment-intent`
returns a nested `payment_intent`, and a missing `payment_url` or `client_secret`
fails loudly with the server's message rather than opening `undefined` in a popup.

Server wording is shown verbatim, as `property-new.tsx` already does — "No paid
package found" and "You already have purchased this package" are distinctions no
generic copy can carry.

**Double-charge risk:** `create-payment-intent` writes a new `PaymentTransaction`
on every call, so a double-click means two pending rows. The intent is created
once per dialog open, and the button is disabled while one is in flight.

## Testing

Vitest and the existing patterns — pure-function tests plus the `fetch` mock from
`api.test.ts`. No new frameworks. The logic lives in four pure functions so it can
be tested without rendering:

| Function | Covers |
|---|---|
| `paymentMethods(rows)` | Folding `[{type,data}]` into the enabled-methods object. |
| `readCatalog(envelope)` | The `active_packages` sibling, the free-package filter, and that a *held* free plan survives it. |
| `gateReason(limits)` | Three booleans → `'ok' \| 'no-package' \| 'limit-reached'`. |
| `isTrustedPaymentMessage(event)` | The PayPal origin check. |

Plus `createPaymentIntent` against the `fetch` mock for the missing-field case.
Stripe's own card form is not unit-tested; that is test-card territory and belongs
in manual QA.

## Configuration and dependencies

No new environment variables. `VITE_API_ORIGIN` already exists and is what the
origin check compares against; the Stripe publishable key arrives at runtime from
`get_payment_settings`, so it never enters the bundle or `.env`.

Two new dependencies, both already used by the website:
`@stripe/stripe-js` and `@stripe/react-stripe-js`. Stripe's JS must be loaded from
`js.stripe.com` and never bundled, so the alternative is hand-writing that loader
and mounting Elements imperatively — roughly 40 lines of lifecycle code to replace
a few KB of officially-supported dependency. Installing them needs explicit
approval per the project rules; it is the only install in this plan.

New i18n keys go in `es.ts` (source of truth) and `en.ts`. The typing makes a
missing English string a compile error rather than a runtime fallback.
