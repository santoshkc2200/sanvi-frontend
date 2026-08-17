# Phase 05 — Privacy Centre & Consent (frontend)

**Target version:** 0.6.0
**Depends on:** frontend 01–04; backend 05
**Unlocks:** lawful operation in the EU/UK, Japan, and the United States; the consent and opt-out
signals phase 10 depends on

## Goal

Consent that is genuinely informed and genuinely revocable where the law requires permission, a
refusal that is easy to express and actually honoured where the law requires choice, a privacy centre
where a person can see, export, correct, and delete their data, and a tenant-facing set of tools so
tenants can meet their own obligations toward their end users.

The single most important architectural point: **the UI does not decide the rules.** The backend
resolves a jurisdiction profile and a directive per purpose; the frontend renders the mode it is
told, in the user's language and the tenant's theme. There is no `if (country === 'US')` in a
component.

## Scope

**In**
- Jurisdiction-aware consent surface: an **opt-in banner** (EU/UK/JP) and a **notice-at-collection +
  opt-out** surface (US), rendered from the same components and the same backend directive snapshot.
- Preference centre, consent-gated script loading, and "Do Not Sell or Share My Personal Information"
  / "Limit the Use of My Sensitive Personal Information" entry points.
- Global Privacy Control: detect `navigator.globalPrivacyControl`, reflect it honestly in the UI, and
  never let a later "accept all" quietly override it.
- `@sanvi/analytics`: directive-aware tracking with a queue that drops rather than stores on refusal.
- Privacy centre in `admin` (tenant staff) and on the storefront (end users): DSR submission, status,
  download, consent/opt-out management, **authorized-agent submission**, and **appeal of a refusal**.
- Platform admin: DSR queue with per-jurisdiction clocks, appeal review, legal holds, retention rules,
  jurisdiction profile viewer, sub-processor list management, breach obligation tracker.
- Legal content surfaces: privacy notice (with US state-specific sections), notice at collection,
  cookie policy, sub-processor list, annual request metrics — versioned and localized.

**Out**
- Legal text authoring (supplied by counsel; the UI renders versioned content).
- Deciding which jurisdiction applies (backend phase 05).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Consent model | One purpose registry (`analytics`, `marketing_email`, `ads_personalisation`, `ads_measurement`, `session_replay`, `sale_or_share`, `targeted_advertising`, `profiling_significant_effects`, `sensitive_pi_use`); essential is never consentable | GDPR requires opt-in, APPI requires purpose clarity, US requires an opt-out per purpose. One registry serves all three |
| Presentation mode | The backend's directive snapshot carries `consent_model: 'opt_in' \| 'notice_and_opt_out'`; the banner renders **blocking opt-in** or **non-blocking notice + persistent opt-out** from that field | Jurisdiction logic in the client would be wrong within a month and untestable today |
| Banner design (opt-in) | Reject and Accept given **equal visual weight**, granular choice one click away, no pre-ticked boxes, no cookie wall | Anything else is a compliance finding waiting to happen |
| Banner design (US) | Notice at collection shown before collection, with a persistent, always-reachable "Your privacy choices" control — **never** a pre-checked "accept" that pretends to be consent | US law does not require a modal; it requires notice and a real, easy refusal. A fake consent modal is worse UX and no more lawful |
| Opt-out link | "Do Not Sell or Share My Personal Information" and "Limit the Use of My Sensitive Personal Information" as footer links on every US-facing page, plus the combined "Your privacy choices" entry | Several states require these by name; a generic "cookie settings" link does not satisfy them |
| GPC | `navigator.globalPrivacyControl` is sent to the backend, shown in the preference centre ("we detected a browser privacy signal and applied it"), and a later "accept all" must explicitly ask before overriding it | A silently overridden GPC signal is the single most-cited enforcement failure |
| Withdrawal | As easy as granting: a persistent footer link and an in-app entry point, one click to change; an opt-out never asks the user to log in or verify | Explicit legal requirement in every regime here, routinely violated |
| Script loading | In opt-in mode nothing non-essential loads before consent. In US mode, anything mapped to `sale_or_share` or `targeted_advertising` is still gated until the notice has been served and the opt-out state is known — the loader waits for the directive snapshot, not for a click | Loading first and "not sending" is not consent; and firing an ad pixel before we know the opt-out state is a sale we cannot undo |
| Storage | Directive decisions in a first-party cookie (necessary) plus a server-side record via the backend for proof | The cookie makes it work; the server record makes it provable |
| Notice versioning | A version bump for a purpose re-prompts only for the affected purposes in opt-in mode; in US mode it re-serves the notice and never resets an existing opt-out | Re-prompting everything for a typo trains users to click through; resetting a refusal is unlawful |
| DSR identity | Signed-in users act directly; anonymous requesters verify by email code; **opt-outs require no identity at all** | Disclosing data to the wrong person is the worst possible outcome, but gating a refusal behind verification is itself a violation |
| Authorized agents | A distinct submission path that collects the agent's details and authorisation document, then tells the consumer plainly that they will be asked to verify | Agents are common in the US and a bolt-on form invites disclosure to the wrong party |
| Appeals | A refused request shows an "Appeal this decision" action and, after the decision, the state authority's complaint route | Required by the VCDPA-family states and trivial to forget until an audit |
| Tenant role | Tenants get a processor / service-provider-facing DSR console for their own end users, with our platform tooling behind it | Tenants are controllers (US: businesses) for their customers' data; the brief's multi-tenancy makes this unavoidable |

## Deliverables

### 1. Consent surface & preference centre

Two modes, one component set, chosen by the `consent_model` field in the directive snapshot:

**Opt-in mode (EU/UK/JP).** Banner: purpose summary, "Accept all" / "Reject all" / "Choose" with
identical prominence, keyboard-first, focus-trapped, dismissible only by making a choice, never
blocking essential content behind an overlay that traps screen readers.

**Notice-and-opt-out mode (US).** A non-blocking notice at collection — categories collected, purposes,
retention, and whether data is sold or shared — with two actions: "Your privacy choices" and the
notice itself. No modal trap, no dark pattern, and no button that records "consent" the law did not
ask for.

Shared:

- Preference centre: one row per purpose with a plain-language description, the concrete consequence
  of enabling it, the vendors involved (from the sub-processor list), and a control whose semantics
  match the mode — a consent toggle (off by default) or an opt-out toggle (on by default, with the
  current source shown: your choice, a browser signal, or the default).
- Sensitive-data section in US mode: "Limit the use of my sensitive personal information", listing
  exactly which sensitive categories the tenant collects, generated from the data map.
- GPC status row: when a browser signal was detected and applied, say so, and require an explicit
  confirmation before any action would override it.
- Persistent footer links: "Your privacy choices" everywhere; in US mode also the statutory
  "Do Not Sell or Share My Personal Information" wording, because the name is part of the obligation.
- Locale-aware (phase 06) and theme-aware (phase 07): a tenant's storefront surface looks like their
  brand, not like ours.
- Records to the backend on every change, with the notice version and jurisdiction, for proof.

### 2. `@sanvi/analytics`

```ts
track(event: string, props?: Record<string, unknown>, purpose: ProcessingPurpose = 'analytics')
```

Events are dropped, not queued, when the purpose is not `allowed` — a queue that flushes on a later
permission would be retroactive collection. The gate reads the resolved **directive**, so the same
call is blocked by an EU absence-of-consent and by a California opt-out without the caller knowing
which. Directive changes propagate synchronously to loaded integrations, and revocation triggers
cleanup (removing cookies the integration set, where possible). Third-party scripts are loaded
through a single gated loader with an allow-list, so a stray `<script>` in a component cannot bypass
the gate. Ad and audience integrations additionally require `sale_or_share`/`targeted_advertising`
to be `allowed`, which is what keeps a US opt-out from being a UI-only gesture.

### 3. Privacy centre

**End user (storefront) and tenant staff (admin), same components:**

| Screen | Contents |
|---|---|
| Overview | What data we hold about you, by category, in plain language, with the purpose and retention; which privacy rules apply to you and why |
| Requests | Submit access/export/erasure/rectification/opt-out; status timeline; acknowledgement and expected completion date from the jurisdiction's clock |
| Download | One-time, expiring, passphrase-protected download with clear instructions |
| Choices | Current state per purpose, its source (your choice / browser signal / default), and change history |
| Erasure | Consequence explanation (what is deleted, what is legally retained and why, what breaks), typed confirmation, cooling-off window |
| Appeal | Shown when a request was refused: reason given, appeal form, decision, and the authority's complaint route |
| Agent | Authorized-agent submission: agent details, authorisation upload, and an explicit statement that the consumer will still be asked to verify |

Erasure is the screen that most deserves care: it must not be one click from a nav item, and it must
be honest about what is retained (invoices, for instance) rather than promising total deletion.

Opt-out is the opposite: it must be *one* click, reachable from the footer of every page, with no
login, no verification, and no confirmation dialog that discourages completion. Users are told the
effective date from the backend's window rather than a vague "shortly".

### 4. Platform admin privacy console

DSR queue with **per-jurisdiction** SLA countdowns (acknowledgement, response, extension, opt-out
propagation, appeal) and overdue highlighting; per-request participant status (which context has
responded); extend deadline with reason; reject with a reason that is shown to the subject and, for
US requests, forces the appeal route to be included; appeal review restricted to an operator who did
not decide the original request; legal holds; retention rule editor with dry-run results; jurisdiction
profile viewer (read-mostly, with an audit trail on every edit); sub-processor registry with role,
transfer mechanism, and change notifications; breach-incident workflow showing **one row per
jurisdiction obligation** with its own deadline, rather than a single 72-hour clock.

### 5. Legal content

Privacy notice, notice at collection, cookie policy, sub-processor list, and the annual request
metrics rendered from versioned, localized content, with a visible "last updated" and a changelog.
The notice renders jurisdiction-specific sections (EU/UK rights and supervisory authority; APPI
purpose-of-use and cross-border disclosure; US state rights, categories collected/disclosed/sold or
shared, retention per category, and the non-discrimination statement) from backend configuration —
the same source that drives enforcement, so the document cannot describe behaviour the system does
not have. Cookie policy is generated from the actual registry of cookies/purposes rather than
hand-written, so it cannot drift from what the app really sets.

## Work breakdown

1. Directive store (cookie + server sync), purpose registry, `consent_model` handling, notice
   versioning and re-prompt logic that never resets an opt-out.
2. Banner/notice + preference centre components in both modes (themed, localized, accessible).
3. GPC detection, transmission, display, and the explicit-override confirmation.
4. Gated third-party script loader with an allow-list, directive gating (incl. sale/share and
   targeted advertising), and revocation cleanup.
5. `@sanvi/analytics` with purpose gating and integration adapters.
6. Footer entry points: "Your privacy choices", the statutory US link wording, and the
   limit-sensitive-use control, rendered per jurisdiction.
7. Privacy centre screens for end users and tenant staff, incl. opt-out, appeal, and agent flows.
8. DSR submission + verification flow for anonymous requesters (email code); opt-out path that
   deliberately skips verification.
9. Export download experience (passphrase handling, expiry, retry).
10. Platform admin privacy console with per-jurisdiction clocks, appeal review, and the breach
    obligation tracker.
11. Legal content rendering incl. jurisdiction-specific sections, notice at collection, annual
    metrics page, versioning, changelog, cookie-policy generation.
12. E2E and a11y coverage of all consent, opt-out, appeal, and DSR journeys in both modes.

## Testing

- Component: banner in every state **in both modes**; equal-weight assertion (a visual test comparing
  button prominence); preference centre controls with correct default polarity per mode; erasure
  confirmation gating; the GPC status row.
- Unit: directive evaluation, notice-version re-prompt logic (and the assertion that a version bump
  does not clear an opt-out), cookie serialisation, analytics drop behaviour.
- Integration: with `ads_measurement` denied, no tracking request is made (network assertion in
  Playwright — the only assertion that actually proves it); with `sale_or_share` opted out, no ad or
  audience integration is loaded and no pixel fires.
- E2E, opt-in mode: nothing non-essential loads before a choice; reject-all keeps it that way.
- E2E, US mode: with a mocked US directive snapshot, essential and analytics load after the notice is
  served, ad integrations stay dormant until the opt-out state is known, the footer opt-out link
  works without logging in, and the opt-out is reflected on reload and on another device after login.
- E2E, GPC: with `globalPrivacyControl` set, sale/share is denied on first paint, the UI says the
  signal was applied, and "accept all" prompts for an explicit override rather than acting.
- E2E, requests: submit an export request, receive it, download it once, second download refused;
  erasure with cooling-off and cancellation; a refused request offers an appeal and shows the
  authority's complaint route; an agent submission cannot reach a download without consumer
  verification.
- a11y: banner and notice are fully keyboard-operable, focus-trapped correctly (opt-in) or
  non-trapping (US notice), announced to screen readers, and do not trap users who ignore them; the
  footer opt-out link is reachable by keyboard from any page.

## Security

- No PII in analytics events; a lint rule flags known-PII prop names, and payloads are schema-checked.
- Download links are single-use and expiring; the passphrase is delivered separately from the link.
- Anonymous DSR submission is rate-limited and never confirms whether an email exists in our system.
- The directive cookie is first-party, `SameSite=Lax`, and contains no identifiers; the device
  reference used to bind a pre-login GPC signal is a random, rotating value with no fingerprinting.
- The opt-out endpoint is rate-limited by device rather than by identity, so abuse protection never
  becomes a verification gate on a refusal.
- Authorized-agent uploads are scanned, size-capped, never rendered inline, and visible only to
  platform operators.

## Acceptance criteria

- [ ] In opt-in mode, no non-essential script loads before consent (network-level e2e proof).
- [ ] In US mode, no ad or audience integration loads before the directive snapshot resolves, and an
      opt-out prevents it entirely (network-level e2e proof).
- [ ] The same components render both modes; switching the mocked jurisdiction changes only the
      backend snapshot, not the component tree.
- [ ] A GPC signal is applied on first paint, disclosed in the UI, and not overridable without an
      explicit user confirmation.
- [ ] "Do Not Sell or Share My Personal Information" and the limit-sensitive-use control are present
      on every US-facing page and work without authentication.
- [ ] Withdrawing consent or opting out is reachable in one click from any storefront page and takes
      effect immediately.
- [ ] A user can request and download their data, and request erasure with an honest explanation of
      what is retained.
- [ ] A refused request can be appealed from the UI, and the decision shows the authority's complaint
      route.
- [ ] Consent UI is localized (en/ja) and themed per tenant.
- [ ] The platform DSR queue shows per-jurisdiction SLA countdowns and per-context progress.
- [ ] Cookie policy content matches the actual cookies set (generated, then verified in e2e), and the
      notice's US sections match the backend's data map and retention rules.

## Risks

| Risk | Mitigation |
|---|---|
| Banner harms conversion, pressure to make "reject" harder | Equal-weight requirement recorded as a compliance constraint, with a visual test that fails if it changes |
| A component adds a third-party script directly | Gated loader is the only allowed path; lint rule + CSP block anything else |
| Users expect erasure to remove everything | Explicit, itemised retention explanation before confirmation |
| Tenants misunderstand their controller obligations | Tenant-facing guidance in the console, plus DPA/sub-processor surfaces |
| A developer adds a client-side `country === 'US'` branch and the two models drift | Mode comes only from the backend snapshot; a lint rule bans jurisdiction literals in components, and the component tests run both modes against the same tree |
| The EU banner is shown to US users "to be safe", collecting consent the law does not ask for and depressing analytics | Mode is driven by the profile; showing a blocking modal in a `notice_and_opt_out` jurisdiction is a test failure, not a preference |
| GPC applied in the UI but the pixel still fires | Enforcement is server-side; the frontend proof is a network assertion, not a state assertion |
| Tenant theme buries the opt-out link | Footer privacy links are rendered by the platform layout and are not theme-overridable; a visual test asserts presence and contrast |
| US requests refused without an appeal route | The rejection form requires it; the subject-facing screen renders it from the jurisdiction profile |
