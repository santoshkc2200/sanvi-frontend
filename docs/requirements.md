# sanvi-frontend — Numbered Requirements

Numbered requirements are the layer that task files trace to. They are introduced **from phase 09
onward**; phases 00–08 shipped before this practice and remain documented by their
`phase-NN-*/implementation-plan.md` files, which stay authoritative for what was built.

IDs are phase-prefixed (`FR-9xx` = phase 09, `FR-10xx` = phase 10, …) so they never collide and so a
requirement's phase is readable from the ID alone. IDs are permanent: when a requirement changes,
edit its text and note the change; when it is dropped, mark it `withdrawn` rather than reusing the
number.

`python3 ~/.claude/skills/sdlc-planner/scripts/sdlc.py check` verifies that every requirement here is
covered by at least one task in `tasks/`, and that every task names a requirement.

Backend requirements are numbered separately in `sanvi-backend/docs/requirements.md`. The two sets
share IDs by coincidence of phase, not by meaning — a frontend task never cites a backend ID.

---

## Phase 09 — Tenant Payments & Storefront Checkout (0.10.0)

Derived from [`phase-09-tenant-payments/implementation-plan.md`](phase-09-tenant-payments/implementation-plan.md)
and sliced into tasks per [`tasks/phase-09/README.md`](tasks/phase-09/README.md).

### Functional

| ID | Requirement |
|---|---|
| **FR-901** | The tenant admin payments settings page lists every provider returned by the catalog as a `PaymentProviderCard`, with an unavailable state for providers unsupported in the tenant's country, and an `UpgradePrompt` in place of the CTA when the entitlement is absent (the cards stay visible). |
| **FR-902** | A tenant admin completes Stripe's embedded `account_onboarding` component inside the admin console, with a pre-connect explainer, and the flow is resumable across tab close and browser restart without starting over. |
| **FR-903** | The settings page states in plain language, in `en` and `ja`, whether the tenant can accept payments and — when they cannot — exactly which requirements are outstanding and by when, with `Restricted` given a distinct, prominent treatment rather than a variant of pending. |
| **FR-904** | Stripe's `notification_banner`, `account_management` and `payouts` embedded components render on the payments settings page, alongside a link to the tenant's real Stripe Dashboard. Stripe's own surfaces are never reimplemented. |
| **FR-905** | A customer completes a purchase from a themed, localized order summary on the tenant's own domain, covering the confirming, confirmation, cancel, decline, expiry and provider-unavailable states with specific messaging for each. |
| **FR-906** | Order state on the confirmation page comes only from `GET /tenant/checkout/{id}`, never the return URL. Webhook lag holds the confirming state rather than rendering a false failure, and a refresh or stale success URL neither creates nor re-reports an order. |
| **FR-907** | The tenant admin has a payments list (date, customer, amount, status, method, payout status) with API-matching filters, cursor pagination and CSV export, and a payment detail with timeline and read-only dispute state deep-linked to Stripe. |
| **FR-908** | A principal holding `payments.refund` can issue a full or partial refund through a permission-gated dialog that requires a reason and shows the exact amount, currency, and remaining refundable balance before submission, submitting once with a per-dialog idempotency key. |
| **FR-909** | The tax section exposes the automatic-tax toggle with the preflight result inline — disabled with a specific reason when the connected account cannot genuinely collect tax — and any applicable platform fee is disclosed on the settings page and per payment. |
| **FR-910** | A tenant can disconnect a provider through a flow that states the consequences plainly, requires typed confirmation, and names the exact blockers returned by the API when disconnect is refused. |

### Non-functional

| ID | Requirement |
|---|---|
| **NFR-901** | No card data ever appears in our code or our DOM. Every card surface is Stripe-hosted (Stripe Checkout) or a Stripe-issued embedded component; account session client secrets are fetched per render, never persisted, never logged. |
| **NFR-902** | Every app declares its CSP through the shared `@sanvi/csp` Stripe preset — `https://js.stripe.com` and `https://*.stripe.com` in `script-src`/`frame-src`/`connect-src` — with no per-app or per-page relaxation and no `unsafe-inline` widening. |
| **NFR-903** | No secret or restricted key pattern (`sk_`, `rk_`) appears in any build output; `scripts/check-no-secret-keys-in-bundle.mjs` asserts it in CI. Only publishable keys reach the client. |
| **NFR-904** | Every user-facing string goes through `@sanvi/i18n` in both `en` and `ja`; no hardcoded colors, fonts, spacing or radii — tokens from `@sanvi/design-tokens` only. Both are lint gates, not review items. |
| **NFR-905** | Payment states, the refund dialog, the order summary and the confirmation page are screen-reader coherent, keyboard operable, and never convey status by colour alone. |
| **NFR-906** | Provider-specific behaviour lives only in a per-provider client adapter (`connect()`, `status()`, `manage()`) registered by `kind`; no component outside the registry branches on the provider kind. |
| **NFR-907** | Connect.js and Stripe.js load only on the pages that need them — never in the general storefront bundle — at a pinned version, and the storefront performance budget still passes with Stripe added. |
| **NFR-908** | All amounts render through the shared money helpers in `@sanvi/billing-elements`; JPY shows no decimals anywhere in any flow, including the refund dialog. |

---

## Phase 10 — Advertising Manager & ROAS Dashboard (0.11.0)

To be numbered (`FR-10xx` / `NFR-10xx`) when phase 10 is decomposed. Until then, see
[`phase-10-advertising/implementation-plan.md`](phase-10-advertising/implementation-plan.md).

## Phase 11 — Performance, Accessibility & GA (1.0.0)

To be numbered (`FR-11xx` / `NFR-11xx`) when phase 11 is decomposed. Until then, see
[`phase-11-hardening-ga/implementation-plan.md`](phase-11-hardening-ga/implementation-plan.md).
