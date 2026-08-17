# Phase 09 — Tenant Payments & Storefront Checkout (frontend)

**Target version:** 0.10.0
**Depends on:** frontend 01–08; backend 09
**Unlocks:** tenants taking money from their own customers

## Goal

Two experiences: a **provider setup** flow where a tenant admin connects Stripe and understands
exactly what is outstanding, and a **storefront checkout** where the tenant's customer pays the
tenant — on the tenant's own domain, in the tenant's theme and locale.

Money flows to the merchant. Nothing in this UI should suggest otherwise, because nothing in the
architecture does.

## Scope

**In**
- Payment provider settings: connect Stripe, embedded onboarding, status and requirements, disconnect.
- Embedded Stripe Connect components in the tenant admin (onboarding, notification banner, account
  management, payments, payouts).
- Storefront checkout: cart/summary → Stripe Checkout on the connected account → result handling.
- Tenant-side order/payment views: list, detail, refunds, disputes (read-only with deep links).
- Provider-agnostic UI shape so a second provider is a new card in a list, not a new codebase.

**Out**
- Building our own card form for tenant checkout. `billing-elements` (Stripe Elements) is available
  and is the fallback if an embedded checkout variant is chosen later; v1 uses Stripe Checkout.
- Marketplace/split-payment UI — not the architecture we chose.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Onboarding | Stripe **embedded `account_onboarding` component**, not a custom form | Custom onboarding forces us to collect sensitive PII and build our own remediation flows |
| Notification banner | The `notification_banner` embedded component is always rendered on the payments settings page | It keeps the connected account healthy as Stripe's requirements evolve, with no work from us |
| Account management | `account_management` embedded component for settings changes; a Dashboard link for everything else (`dashboard: "full"` accounts have the real Stripe Dashboard) | Do not reimplement Stripe |
| Checkout | Stripe Checkout Session created on the connected account, redirect from the tenant's own domain | Handles SCA, local payment methods, and localisation |
| Payment methods | Never request specific payment method types in the UI; whatever Stripe enables for that account is shown | Hardcoding cards would lock Japanese buyers out of the methods they expect |
| Result truth | Order state comes from our API (webhook-driven), never from the return URL | The redirect is a hint; the webhook is the fact |
| Status honesty | Show the exact outstanding requirements and the go-live blocker in plain language | "Pending" with no detail generates support tickets |
| Capability gating | Checkout UI is disabled until the connected account's card payments capability is active, with a clear reason | Matches the backend's v2 capability check |

## Deliverables

### 1. Payment settings (`admin`)

| Section | Contents |
|---|---|
| Providers | Cards for available providers (Stripe today; the layout assumes more), entitlement-gated with `UpgradePrompt` |
| Connect | Explanation of what happens, what data Stripe collects, and that payouts go to the tenant's own bank account — then the embedded onboarding component |
| Status | Capability states (card payments, payouts), outstanding requirements with deadlines, the notification banner, and an explicit "you can/cannot accept payments yet" verdict |
| Account | Embedded account management + Stripe Dashboard link |
| Payouts | Embedded payouts component (read-only for us) |
| Disconnect | Consequences (checkout stops, existing payments unaffected), blocked while payments are in flight or disputes are open |

Onboarding is resumable: a tenant who closes the tab returns to the same place, with progress shown.

### 2. Storefront checkout

```
order summary (themed, localized, tax note per the tenant's settings)
  → POST /tenant/checkout                 (our API; creates the session on the connected account)
  → redirect to Stripe Checkout           (locale from phase 06, branding from the connected account)
  → return to the tenant's own domain     (phase 08)
  → "confirming your payment" state polling our API
  → confirmation page: what was bought, receipt, next steps
```

Cancel returns to the summary with the cart intact. Failure states are specific ("your card was
declined — try another method") rather than "something went wrong". The confirmation page is the
conversion event source for phase 10, with the server-side value as the trustworthy number.

### 3. Payments & orders (`admin`)

- Payments list: date, customer, amount, status, method, payout status; filters and CSV export.
- Payment detail: timeline, refund action (full/partial with reason, permission-gated, idempotent
  with a confirmation showing the exact amount in the right currency), dispute state and deep link.
- Payouts: schedule and history via the embedded component.
- Empty states that teach: before the first payment, the page explains what will appear here.

### 4. Provider-agnostic shape

A `PaymentProviderCard` component with a per-provider adapter (`connect()`, `status()`, `manage()`),
so adding PayPal or a Japanese provider later means a new adapter and a new card, not a redesign of
the settings page.

## Work breakdown

1. Payment settings screens + provider catalog + entitlement gating.
2. Stripe Connect embedded components integration (Connect.js loader, account session fetch, theming
   the components with our token values where the API allows).
3. Status/requirements presentation with plain-language mapping of Stripe requirement codes.
4. Disconnect flow with guards and consequences.
5. Storefront order summary, checkout initiation, redirect handling, confirming state, confirmation
   page (themed, localized).
6. Failure and cancellation states with specific messaging.
7. Payments/orders list and detail, refunds, disputes read-only.
8. CSP updates via `@sanvi/csp` for Stripe origins (`script-src`, `frame-src`, `connect-src`).
9. E2E across the sandbox: onboarding, checkout, refund, decline, dispute display.

## Testing

- E2E (Stripe test mode + test connected accounts): connect → onboard → active → checkout → succeed;
  decline path; 3DS-required path; refund; disconnect blocked with an open dispute.
- Component: status/requirement rendering for restricted, pending-verification, and active accounts;
  refund confirmation arithmetic in JPY (no decimals) and USD.
- Integration: checkout button disabled while the account cannot accept payments, with the reason shown.
- Resilience: webhook delay on the confirmation page (holds the confirming state, no false failure);
  user returns to a stale success URL (no duplicate order).
- Visual: checkout summary and confirmation across themes and locales.
- a11y: order summary and payment states are screen-reader coherent; no colour-only status.

## Security

- No card data in our code or our DOM; Stripe-hosted checkout and Stripe-issued embedded components.
- CSP allows `https://*.stripe.com` in `script-src`/`frame-src`/`connect-src` through the shared
  package — a missing or over-permissive CSP weakens the XSS protection Stripe.js relies on.
- Account session client secrets are fetched per render, short-lived, never persisted or logged.
- Refunds require an elevated permission and a reason; the confirmation shows the exact amount and
  currency before submission.
- Publishable keys only in the client; a CI check asserts no secret/restricted key pattern appears in
  any build output.

## Acceptance criteria

- [ ] A tenant connects Stripe through embedded onboarding, sees exactly what is outstanding, and
      reaches an "you can accept payments" state.
- [ ] The notification banner is present on the payments settings page.
- [ ] A customer completes a purchase on the tenant's own domain, in the tenant's theme and language,
      and the funds are the tenant's.
- [ ] Checkout is impossible (and clearly explained) while the account cannot accept payments.
- [ ] Refunds work and are correct in JPY and USD.
- [ ] No secret keys and no card data in any client bundle (CI-asserted).

## Risks

| Risk | Mitigation |
|---|---|
| Embedded component styling clashes with tenant themes | Use the components' supported appearance options mapped from our tokens; the settings surface uses our own theme, not the tenant storefront theme |
| Tenants stall in onboarding | Requirement explanations, resumable flow, reminders, notification banner, and a "what happens next" summary |
| Users think Sanvi holds their money | Copy states plainly that payouts go to the tenant's own Stripe account and bank |
| Stripe embedded component API changes | Pinned Connect.js version, integration tests in CI, upgrade tracked like any dependency |
| Confirmation page double-counting conversions (phase 10) | A single conversion event id issued server-side per order; the page reports it idempotently |
