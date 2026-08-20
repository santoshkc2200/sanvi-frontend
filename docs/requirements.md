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

Derived from [`phase-10-advertising/implementation-plan.md`](phase-10-advertising/implementation-plan.md)
and sliced into tasks per [`tasks/phase-10/README.md`](tasks/phase-10/README.md).

### Functional

| ID | Requirement |
|---|---|
| **FR-1001** | The admin advertising settings route is registered in the SPA router and entitlement-gated: it renders `UpgradePrompt` without the entitlement and an empty state with it, served by the generated `advertising` API client, with ad-account-currency, zero-decimal, and ratio formatters in `@sanvi/ui` that render `—` rather than `∞` or `NaN` at zero spend. |
| **FR-1002** | A capability-matrix-driven form engine in `@sanvi/ui` turns a backend-provided matrix plus a draft into rendered inputs: fields the platform cannot express are absent rather than broken, client-side limits come from the matrix, and backend violations are mapped back onto their inputs by field path. The frontend holds no hand-maintained copy of any objective, limit, or placement list. |
| **FR-1003** | The connection screen explains per scope what will be requested and why before connecting, hands off to the backend-issued authorization URL, and returns to an account picker showing account name, external id, currency, and **timezone**. Health states (healthy, token expiring, re-consent required naming the missing scope, disconnected, last sync failed) each offer the one action that fixes them. Disconnect states plainly that campaigns keep running and keep spending on the platform, requires typed confirmation and step-up, and reconnecting the same account is a distinct path that preserves campaign history. |
| **FR-1004** | The campaign list is a cross-platform table — name, platform badge, status, budget, spend, conversions, ROAS, drift indicator — with bulk pause/resume whose confirmation names the count and the combined daily budget affected, mixed-platform sorting, and per-connection currencies rendered natively with no summed total row. |
| **FR-1005** | The campaign builder is a stepper (objective → targeting → budget & schedule → creatives → review) composed entirely from the form engine against the live matrix, validating per step through the `validate` endpoint, autosaving and resuming drafts across a refresh, and requiring explicit confirmation showing the daily and projected monthly delta for a budget increase above the configured threshold. |
| **FR-1006** | Campaign detail renders ad groups, ads, per-ad review status with the platform's rejection text **verbatim**, and the change log as readable history; the drift view diffs our intent against the platform's current state field by field and offers "keep theirs" and "reapply ours" as equal-weight choices with no default selection and no auto-resolve. |
| **FR-1007** | Creative management uploads assets through the existing `@sanvi/course-media` path, renders per-locale copy fields with character counters driven by the matrix, previews each selected placement with the real assets and copy under phase-07 theming and phase-06 CJK typography, and reports a spec failure at upload naming the placement and the dimension, with the option to drop the placement instead of the asset. |
| **FR-1008** | The tracking setup screen presents the event-to-conversion-action mapping as a per-platform matrix, states the privacy dependency naming the purposes and linking to the privacy centre, and offers a one-click test event that shows live what was captured, what the directive resolver decided, and which click ids were present. The storefront beacon posts same-origin with the server-issued `event_id` from the confirmation payload, via `sendBeacon` with a fetch fallback, never blocking the confirmation render. |
| **FR-1009** | The diagnostics view lists recent conversions with per-platform upload status, dedupe status, and suppression reason, filterable by outcome and expandable to the full per-event story; every taxonomy category (*missing consent*, *opted out of sale/share*, *browser privacy signal*, *withdrawn after capture*, *missing click id*, *upload error*, *token expired*) maps to its own plain-language sentence; the health banner shows suppression and upload failure **separately**; and a retry affordance renders only on genuinely retryable rows. |
| **FR-1010** | `@sanvi/ui` ships line, bar, stacked bar, and sparkline primitives on one small tokenized layer, coloured from phase-07 tokens, each shipping an accessible data-table equivalent, handling empty, single-point, and dense data, and built against the contract's fixed metric shapes rather than a live backend. |
| **FR-1011** | The dashboard renders header KPIs (spend, revenue, ROAS, conversions, CPA) with period comparison and sparklines, a time series with platform/campaign breakdown and spend-vs-revenue overlay, and a sortable exportable table by campaign/ad group/ad — with both attribution sources labelled at the point of display, an attribution explainer one click from every ROAS figure, restatement-window days visibly marked "still updating", the ad account timezone stated next to the date range, and distinct states for no connection, no spend, sync in progress, sync failed, and partial data. |
| **FR-1012** | Budget cap configuration (per campaign and per tenant, daily and monthly) previews current spend, projected spend at the run rate, and the date the cap would be hit; enabling auto-pause requires a plain-language consequence statement and typed confirmation; raising a cap above the threshold and lowering one below current spend each warn before applying; and the alert history, the dashboard cap progress indicator, and a permanent second-line disclosure state the data freshness behind every figure. |

### Non-functional

| ID | Requirement |
|---|---|
| **NFR-1001** | No platform-specific frontend code exists in any form path. Availability, field logic, and validation come from the capability matrix alone; a grep gate fails on platform literals (`'meta'`, `'google_ads'`, objective and limit constants) in form paths, and the fake adapter's third matrix must render a valid builder with no code change. |
| **NFR-1002** | Platform-reported and Sanvi-observed numbers are always shown together and labelled at the point of display, never in a footnote. No blended ROAS or conversion-value field appears in any component, chart, KPI tile, or export — grep-asserted. |
| **NFR-1003** | The frontend never handles an ad platform token, OAuth client secret, or developer token, and never constructs an authorization URL; ad account connect and disconnect require step-up authentication. `scripts/check-no-secret-keys-in-bundle.mjs` asserts no credential pattern reaches any build output. |
| **NFR-1004** | Every user-facing string goes through `@sanvi/i18n` in `en` and `ja`, and no colour, font, spacing, or radius is hardcoded — tokens from `@sanvi/design-tokens` only, charts included. Japanese number, currency, and CJK line-breaking behaviour is asserted inside charts and placement previews, not only in prose. |
| **NFR-1005** | Charts carry text alternatives and accessible data tables, status/drift/threshold state is never conveyed by colour alone, the campaign builder — stepper and creative uploader included — is fully keyboard operable, and diagnostics tables are screen-reader coherent. axe checks pass on every new surface. |
| **NFR-1006** | The dashboard route is lazy-loaded and the chart layer stays within the performance budget; the storefront bundle grows only by the tracking beacon, which is same-origin and requires no CSP relaxation. `pnpm check:budget` enforces both. |
| **NFR-1007** | Amounts render in the ad account's own currency through the shared formatters, JPY with no decimals; an FX conversion is explicit and carries its rate date; two connections in different currencies are rendered natively side by side and never summed; the ad account timezone is stated wherever a date range is. |
| **NFR-1008** | Diagnostics and exports show hashed identifiers only and no raw customer data; export is permission-gated and streamed for long ranges. Every app declares its CSP through the shared `@sanvi/csp` `ads()` preset with no per-app relaxation and no `unsafe-inline` widening, and the storefront's policy is unchanged by this phase. |

## Phase 11 — Performance, Accessibility & GA (1.0.0)

To be numbered (`FR-11xx` / `NFR-11xx`) when phase 11 is decomposed. Until then, see
[`phase-11-hardening-ga/implementation-plan.md`](phase-11-hardening-ga/implementation-plan.md).
