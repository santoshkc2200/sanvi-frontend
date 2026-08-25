# sanvi-frontend — Numbered Requirements

Numbered requirements are the layer that task files trace to. They are introduced **from phase 09
onward**; phases 00–08 shipped before this practice and remain documented by their
`phase-NN-*/implementation-plan.md` files, which stay authoritative for what was built.

IDs are phase-prefixed (`FR-9xx` = phase 09, `FR-10xx` = phase 10, …) so they never collide and so a
requirement's phase is readable from the ID alone. IDs are permanent: when a requirement changes,
edit its text and note the change; when it is dropped, mark it `withdrawn` rather than reusing the
number.

Two invariants hold over this file and [`tasks/`](tasks/backlog.md), and are checked in review:
every requirement here is covered by at least one task, and every task names a requirement.

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

---

## Phase 11 — Performance, Accessibility & GA (1.0.0)

Derived from [`phase-11-hardening-ga/implementation-plan.md`](phase-11-hardening-ga/implementation-plan.md)
and sliced into tasks per [`tasks/phase-11/README.md`](tasks/phase-11/README.md).

Phase 11 adds no user-facing capability. The single exception is FR-1117's quota and usage surfaces.
Everything else here improves, measures, or proves what already exists — so most of these
requirements are satisfied by a committed number, a recorded manual pass, or a published statement,
not by a new screen.

### Functional

| ID | Requirement |
|---|---|
| **FR-1101** | RUM collection — Core Web Vitals plus navigation and resource timing — is live in staging and beta from the first slice of the phase, so the performance slice opens with four weeks of real p75s rather than lab guesses. Sampling, directive gating through the phase-05 resolver (this is telemetry, and it is gated like everything else), and PII scrubbing are configured at the point collection starts, not retrofitted. |
| **FR-1102** | CI carries three harnesses — per-app **and per-route** bundle budgets, Lighthouse CI per app per locale, and an axe sweep — all **reporting-only** at first and promoted to blocking in the performance and accessibility slices respectively. A gate switched on before a baseline exists is a gate someone disables in week one. |
| **FR-1103** | Measurements are comparable across the whole phase: pinned throttling profiles for mid-range Android and iOS Safari, a pinned Lighthouse/Chrome version, and a release stamp on every app build carrying the same identity `GET /api/v1/system/build` returns, passed to the error tracker and RUM as the release tag. The first full harness run across four apps × two locales is committed as `benchmarks/frontend/rc.1.json` with the worst ten routes per app listed — that list, not intuition, is the performance slice's work queue. |
| **FR-1104** | Error tracking is live with source maps uploaded privately and **never served**, release tagging from FR-1103's build identity, breadcrumbs and payloads scrubbed of PII before send, and the tracker itself directive-gated where a jurisdiction requires it. |
| **FR-1105** | RUM is segmented by route, tenant, locale, device class, and theme revision, and release health tracks error rate and vitals per release with an automatic flag on regression against the previous release, wired into the same alert tiers as the backend. An average hides the tenant with the heavy Japanese font and the expensive published theme, and that tenant is the reason the segmentation exists. |
| **FR-1106** | Every error screen shows a trace id matching the backend's `traceparent`, and a "copy diagnostics" action puts release, route, tenant, locale, trace id, and the last few breadcrumbs on the clipboard in one paste. Frontend logging carries no PII, is sampled, is off by default in production, and is enabled per session only by an operator action that is itself audited. |
| **FR-1107** | Per-app and per-route bundle budgets become **blocking**, and the bundle audit resolves duplicate dependencies (one date library, not three), oversized imports, and barrel-file bloat. Route-level splitting is paired with prefetch on intent — hover, focus, viewport — that respects Save-Data and slow connections, because a prefetch that fires on a 3G phone is a regression dressed as an optimisation. |
| **FR-1108** | Fonts are subset per locale with `unicode-range`, only what the negotiated locale needs is preloaded, and a metric-compatible fallback prevents the swap from shifting layout. The Japanese font budget is measured and reported **separately** — a single global font number hides the only case that is hard. |
| **FR-1109** | Images ship responsive `srcset` and modern formats, explicit dimensions on every image and embed (CLS), lazy-loading below the fold, `fetchpriority` on the LCP element, and CDN transforms with size caps for tenant uploads, so one tenant's 8 MB hero cannot blow the budget for their own storefront. |
| **FR-1110** | Streaming SSR is used where it improves first paint with hydration deferred for below-the-fold islands and the interaction-ready moment measured rather than assumed; every remaining third-party script is justified, deferred, and directive-gated, re-verified in **both** the opt-in and the US notice-and-opt-out modes; and the top INP offenders found by long-task profiling on the pinned device profiles are fixed. |
| **FR-1111** | Every route has an error boundary with a recovery action and the FR-1106 trace id — never a blank page, and never a full-app crash from one panel — and each app has a designed backend-outage experience: storefront serves cached content and says what is stale, admin explains and offers retry, marketing is static and unaffected, platform-admin surfaces the incident directly. A route-by-route audit confirms every async surface has loading, empty, error, and success states with a timeout and a terminal state; no infinite spinner remains. |
| **FR-1112** | Retry UX uses exponential backoff with jitter, offers a manual retry affordance, respects `Retry-After` from a `503`, and labels honestly: idempotent mutations retry silently, non-idempotent ones ask. Offline detection queues actions that are safe to defer and messages honestly about those that are not; nothing is queued that could execute twice. |
| **FR-1113** | The e2e suite gains 3G-throttled runs of the critical journeys per app plus an offline variant for the storefront. |
| **FR-1114** | The auth surface is re-reviewed: session handling, token storage (nothing sensitive in `localStorage`), logout completeness across tabs, CSRF posture on every non-GET, and the phase-02 and phase-10 OAuth handoffs re-verified against redirect injection. Every CSP widening added during phases 07–10 is removed, asserted per app in a snapshot test after a report-only rollout, and the phase-10 build-output secret scan is extended to every app and every secret class (OAuth client secrets, developer tokens, signing keys, internal hostnames) as a blocking gate. |
| **FR-1115** | A public status page fed by the backend's external probes is live in both locales with incident history, linked from the marketing footer and from the admin outage screens. Maintenance and degraded banners are driven by the same signal operators set — not a separate manual toggle that gets forgotten — dismissible where informational and persistent where the user's action would fail. While a tenant is being restored, that tenant's admin shows an honest state rather than an empty dataset that reads as data loss. |
| **FR-1116** | `packages/api-client` handles `429` once for all four apps: respect `Retry-After`, back off with jitter, expose a typed rate-limit error, and never automatically retry a non-idempotent mutation. The client is regenerated from the frozen spec and the hand-written workarounds accumulated while shapes were moving are deleted — each deletion is evidence the consistency pass worked. |
| **FR-1117** | Tenant admin shows current usage against limit per metered dimension with a warning threshold before the wall and the upgrade path inline; each metered dimension has its own designed limit-reached state naming the limit, the reset time, and the upgrade action (a blocked upload reads differently from a blocked API call); and platform admin exposes per-tenant usage with audited limit overrides. |
| **FR-1118** | axe runs across every route of all four apps in both locales in CI, **blocking** on serious and critical, with route coverage asserted: a new route with no axe run fails the gate. |
| **FR-1119** | Manual accessibility passes are completed and recorded per app with a checklist and a named runner: keyboard only; screen readers (NVDA, JAWS, VoiceOver — at least two per app, one of them on iOS); zoom to 400 % and 320 px reflow; reduced motion; forced colours. Focus management is verified for dialogs, drawers, route changes, async results, toasts, and above all the phase 08–10 wizards — focus moves to the right place, returns to the trigger on close, is never trapped except deliberately, and is never lost to a removed element — and route changes announce. Forms carry programmatic labels, `aria-describedby` error association, an error summary with skip links to each field, non-visual required-ness, and no colour-only status anywhere in the product. |
| **FR-1120** | Every chart has an accessible data table alternative, a text summary of the trend, and non-colour encodings (shape, pattern, direct labels) — the ROAS dashboard is the densest surface in the product and therefore the one most likely to fail. The phase-07 contrast gates are re-run against **real published themes** from scale data rather than the default token set, and a theme that would fail is rejected at publish time with a clear message rather than rendered at AA-minus. Japanese line breaking, ruby text where used, and 400 % zoom with CJK are asserted, and labels that overflow in one locale are found by test rather than by a user. |
| **FR-1121** | The external accessibility audit is executed against the release candidate, findings are triaged within a week, every serious and critical finding is remediated before GA with a regression test, and an accessibility statement is published per app in both locales naming the standard, the known gaps with dates, the assistive technologies tested, and a contact route for reporting problems. |
| **FR-1122** | Platform admin can start, monitor, and download a tenant offboarding export and view its purge report, with a two-person confirmation on the purge step because it is irreversible by design; the per-class retention status report is surfaced for platform operators and reused by the compliance evidence pack rather than rebuilt for it; and a tenant admin querying an archived period (advertising metrics and audit history most likely) is told so with the restore path rather than shown an empty chart that looks like data loss. |
| **FR-1123** | Every phase-05 privacy surface is re-verified against the current system: consent and opt-out flows in both modes, GPC handling on custom domains, the preference centre's effect on the phase-10 tracking endpoint, and DSR submission per jurisdiction. The platform console shows the generated notice, its approval state, and the diff since last approval, so publishing an unreviewed notice takes a deliberate action, and evidence packs are downloadable with the generating build and period stamped on the artifact, with access audited. |
| **FR-1124** | The e2e suite covers every phase's critical journeys against staging on every release — signup and tenant provisioning, auth including social, RBAC boundaries, platform billing checkout and portal, privacy centre in both consent modes, locale switching, theme publish, domain connect and purchase, tenant Connect onboarding and storefront checkout, campaign publish and conversion flow, quota-limit states, and an offline/degraded variant per app — run across an agreed, written-down browser and device matrix (latest two versions of Chrome, Safari, Firefox, Edge, plus iOS Safari and Android Chrome on mid-range hardware). |
| **FR-1125** | Zero known flakes exist at GA: anything intermittent is quarantined with an owner and a deadline, and quarantine is visible in the run output rather than silent. The visual regression baseline covers key screens across themes × locales, is stable across two consecutive runs on the same build, and its diffs are reviewed rather than auto-accepted. |
| **FR-1126** | Documentation is complete at GA: the component library is published, the contribution guide is current, a frontend incident runbook exists, and an onboarding path a new engineer can follow unaided is **verified by having someone follow it** and recording where they got stuck. Release-health alerting is watched through each rollout stage and the ramp halts automatically on a vitals or error-rate regression. |

### Non-functional

| ID | Requirement |
|---|---|
| **NFR-1101** | **Field data decides.** Core Web Vitals are judged at p75 in RUM over at least a week on the new build; Lighthouse is the regression guard, not the goal. A build can score 100 in the lab and still be slow for the tenant with a heavy theme and a CJK font, which is exactly the tenant the targets are set by. |
| **NFR-1102** | Field targets, both locales, storefront: LCP ≤ 2.0 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75. Budgets: storefront initial JS ≤ 100 KB gzip, admin ≤ 250 KB gzip, and **every route inside its own budget**. Lab guard: Lighthouse mobile storefront ≥ 95 performance, 100 accessibility, 100 best practices, ≥ 95 SEO. Japanese page budgets are reported separately and met separately. |
| **NFR-1103** | Zero serious or critical axe findings across every route × every locale × both themes, with the gate blocking and route coverage asserted. Accessibility fixes are not rolled back; a regression here is a defect, not a trade-off. |
| **NFR-1104** | No PII reaches any telemetry destination: RUM payloads carry no PII and no full URLs with query strings and are suppressed entirely when the directive resolver says no; error-tracker payloads carry no email, no session token, and no full query string; source maps are uploaded privately and never served. |
| **NFR-1105** | Every async surface has loading, empty, error, and success states and a timeout with a terminal state — audited route by route, not asserted. The uncaught error rate stays below 0.1 % of sessions. |
| **NFR-1106** | Phase 11 ships no new user-facing capability except FR-1117's usage and quota surfaces. Every other change improves, measures, or proves what exists. |
| **NFR-1107** | Measurements are comparable or they are worthless: pinned device profiles, a pinned Lighthouse/Chrome version, benchmarks committed per release candidate, and every optimisation slice compared against the stored `rc.1` baseline. A reverted optimisation that leaves the gate green is a gate measuring nothing, so budgets stay blocking regardless of what is reverted. |
| **NFR-1108** | Every app declares its CSP through the shared preset with no per-app widening and no `unsafe-inline`; no credential pattern of any class reaches any build output, asserted by a blocking gate across all four apps. |
| **NFR-1109** | Every user-facing string added by this phase — status page, incident templates, degraded and maintenance banners, quota and limit-reached states, archived-range messaging, accessibility statements — goes through `@sanvi/i18n` in `en` and `ja`, and uses `@sanvi/design-tokens` only. A status page that speaks only English fails half the users during the one event they need it. |
| **NFR-1110** | Every finding from the external accessibility audit and from the penetration test carries a regression test that fails against the defective commit, so the same class of defect cannot return. Where an automated lint gate should have caught it, the gate is strengthened rather than the instance merely fixed. |
