# Phase 04 — Pricing, Checkout & Billing UI (frontend)

**Target version:** 0.5.0
**Depends on:** frontend 01–03; backend 04
**Unlocks:** self-service signup and revenue

## Goal

The commercial surface: a marketing pricing page, a signup-to-subscribed flow that does not lose
people, and a tenant billing centre where a subscription can be understood and managed without
contacting support. Payment collection itself is Stripe-hosted — we build the surrounding experience,
not a card form.

## Scope

**In**
- Marketing: pricing page, plan comparison, currency/locale-aware prices, FAQ, upgrade CTAs.
- Signup → tenant creation → plan selection → Stripe Checkout → post-checkout state handling.
- Tenant billing centre: current plan, usage vs entitlements, invoices, payment method, portal entry.
- Dunning and lifecycle states: trial ending, past due, grace period, suspended, canceled.
- Entitlement-aware upsell surfaces across the app (`UpgradePrompt`).

**Out**
- Custom card forms. `billing-elements` (Stripe Elements) is reserved for phase 09's tenant
  storefront checkout; the platform's own billing uses Stripe Checkout and the Customer Portal.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Payment UI | Stripe **Checkout** (redirect) for subscribe, **Customer Portal** for management | SCA, dynamic payment methods, tax, proration, and localisation handled by Stripe; nothing to maintain |
| Post-checkout truth | Poll our own API for subscription state after the redirect; **never** grant access from `?success=true` | The backend grants on webhooks; the redirect is only a UI hint |
| Post-checkout waiting | Optimistic "activating your account" state with progressive polling and a clear fallback if the webhook is slow | The 2–10 s webhook gap is where naive implementations show a broken dashboard |
| Prices | Rendered from backend-provided minor units + currency using `billing-elements`' `money.ts` helpers | JPY has no decimals; `minorUnitExponent` already models this correctly |
| Plan display | One card per plan tier, matching the backend's one-Product-per-tier catalog | Line items in Stripe show the Product name; the UI and the invoice must agree |
| Trials | Countdown surfaced in the app shell from 7 days out, escalating in the last 48 h | Silent trial expiry is the top churn own-goal |
| Past due | Non-blocking banner during grace, blocking interstitial after, with the portal one click away | Recoverable states should not feel terminal |
| Tax | The UI states that tax is calculated at checkout and, for B2B, offers tax-ID entry in Checkout | Tax correctness is the backend's registration state; the UI must not promise more |

## Deliverables

### 1. Marketing pricing page

- Plan cards from `GET /public/plans` (localized names, features, prices per currency and interval).
- Monthly/annual toggle with savings, currency selector defaulting from locale (phase 06).
- Feature comparison table with tooltips sourced from the feature catalog, so pricing copy and
  entitlements cannot drift apart.
- Prerendered with a short revalidation window; prices are content, not live data.
- Structured data (SEO) and a per-plan CTA that carries the selected plan into signup.

### 2. Signup → subscribed flow

```
choose plan → create account (phase 02) → create tenant (name, slug availability, region, locale)
  → confirm plan (trial terms shown explicitly) → POST /tenant/billing/checkout-session
  → redirect to Stripe Checkout → return
  → "setting up your workspace" state, polling subscription status
  → dashboard with the onboarding checklist (phase 03)
```

Every step is resumable: leaving after tenant creation but before checkout lands the user on a
"finish setting up billing" state rather than a dead tenant. Slug availability checks are debounced,
suggest alternatives, and explain the rules.

### 3. Billing centre (`admin`)

| Section | Contents |
|---|---|
| Overview | Current plan, price, interval, renewal date, trial/past-due status, seats/quotas |
| Usage | Per-feature usage vs limits with thresholds and links to what consumes them |
| Change plan | Compare, preview proration ("you will be charged ¥X today"), then hand off to the Portal |
| Payment method | Summary + "manage in Stripe" (Portal) |
| Invoices | Table with number, date, amount, status, hosted invoice and PDF links |
| Cancel | Retention step explaining what is lost and when access ends, not a dark pattern, with reactivation offered until period end |

### 4. Lifecycle surfaces

`UpgradePrompt` (inline, contextual — shown where the gate bites, not on a generic upsell page),
`TrialBanner`, `PastDueBanner`, `SuspendedInterstitial`, `QuotaExceededDialog`. All driven by tenant
entitlements + subscription state from phase 03's context, so any feature can gate itself with:

```svelte
{#if hasFeature('domains.custom')}
  <DomainWizard />
{:else}
  <UpgradePrompt feature="domains.custom" />
{/if}
```

## Work breakdown

1. Pricing data loading, currency/interval handling, `money.ts` integration and formatting.
2. Marketing pricing page + comparison table + SEO.
3. Signup flow: account → tenant → plan → checkout redirect, with resumability at each step.
4. Post-checkout activation state with progressive polling, timeout messaging, and support fallback.
5. Billing centre screens.
6. Portal integration (session creation + redirect + return handling + cache invalidation).
7. Lifecycle banners/interstitials and the entitlement-driven gating components.
8. `UpgradePrompt` placement pass across existing gated features.
9. E2E against Stripe test mode for the full lifecycle.

## Testing

- Unit: money formatting per currency/locale (JPY zero-decimal, USD, EUR); proration preview copy;
  plan comparison derivation.
- Component: every lifecycle banner state; quota meter thresholds; cancel flow states.
- E2E (Stripe test mode): subscribe with a test card, land on the activation state, reach the
  dashboard once the webhook arrives; failed card → dunning banner → recover via Portal; cancel →
  access until period end; upgrade → immediate entitlement change.
- Resilience: webhook delayed 30 s (activation state holds, no broken dashboard); user closes the tab
  mid-checkout (resumable); user returns to a stale success URL (no double subscription).
- a11y: pricing table and plan cards are navigable and comparable by screen reader.

## Security

- No card data touches our code; Stripe Checkout and Portal are hosted surfaces.
- CSP allows Stripe origins via `@sanvi/csp` — `https://*.stripe.com` in the relevant directives —
  configured centrally rather than per app.
- Checkout/Portal session URLs are single-use, never logged, never placed in browser history state.
- Billing screens require `billing.*` permissions; the cancel action requires elevated permission.

## Acceptance criteria

- [ ] A visitor goes from the pricing page to a working, subscribed workspace without help.
- [ ] Access is granted only after the backend confirms the subscription, and the waiting state is
      pleasant rather than broken.
- [ ] Prices render correctly in JPY and USD, monthly and annual, in both locales.
- [ ] Every lifecycle state (trialing, past due, grace, suspended, canceled) has a designed screen.
- [ ] An entitlement change from platform admin is reflected in the tenant UI within seconds.
- [ ] Lighthouse performance on the pricing page ≥ 95 mobile.

## Risks

| Risk | Mitigation |
|---|---|
| Webhook lag makes the post-checkout state look broken | Designed activation state, progressive polling, honest messaging, support link after 60 s |
| Users abandon at tenant creation | Slug suggestions, minimal required fields, resumable flow, progress indicator |
| Pricing copy drifts from actual entitlements | Comparison table generated from the feature catalog, not hand-written |
| Dark-pattern accusations on cancel | One retention step, clear "cancel anyway", no hidden paths — reviewed by design and legal |
