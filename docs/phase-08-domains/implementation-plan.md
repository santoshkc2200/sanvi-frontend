# Phase 08 — Domain Connect & Purchase Wizard (frontend)

**Target version:** 0.9.0
**Depends on:** frontend 01–04; backend 08
**Unlocks:** tenants running on their own domain

## Goal

Two wizards that turn the hardest self-service step in any SaaS into something a non-technical
tenant admin can finish alone: **connect** a domain they already own (with registrar-specific,
copy-pasteable instructions and honest live status), or **purchase** one through Sanvi and have
everything configured automatically.

## Scope

**In**
- Domain list and detail screens with real status, not a spinner that lies.
- Connect wizard: enter domain → records with copy buttons and registrar-specific guides → live
  verification progress → certificate issuance → live.
- Purchase wizard: search → availability and pricing → registrant details → confirm and pay →
  automatic configuration → live.
- Domain health surfaces, expiry/renewal management, primary-domain switching, removal.
- Localized guides (en/ja), including Japanese registrars.

**Out**
- Email/MX configuration (we state clearly that we do not provide email hosting).
- Bulk domain management (single-domain flows first; the list view scales to a handful).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Wizard state | Server-owned; the UI reflects the backend's domain status machine | A wizard that keeps its own truth desynchronises the moment a user refreshes |
| Progress feedback | Poll status with backoff, showing *what* is being waited on ("waiting for DNS to propagate — this usually takes 5–30 minutes") | DNS is slow; silence reads as failure |
| Resumability | Leave and return to exactly the same step, including from a different device | Verification takes hours in the worst case |
| Instructions | Registrar detected from NS records → specific guide (Cloudflare, Route 53, お名前.com, GoDaddy, Value Domain…) with screenshots, plus a generic fallback | "Add a CNAME record" is not instructions for most people |
| Copy affordance | Every record value has a copy button with confirmation; record blocks are also copyable as a set | Transcription errors are the top support cause here |
| Failure messaging | Distinguish "not found yet", "found but wrong value", "conflicting record", "propagating", "registrar blocks this" — each with a specific fix | One generic error teaches users nothing |
| Purchase pricing | Show the total including renewal price for year two, before payment | Registrar first-year discounts are the classic unpleasant surprise |
| Entitlement | Custom domains gated by `domains.custom`; the gate shows an `UpgradePrompt` (phase 04) rather than hiding the feature | Discoverability drives upgrades |

## Deliverables

### 1. Domain list & detail

- List: hostname, role (primary/alias/redirect), status chip, certificate expiry, health, actions.
- Detail: status timeline (claimed → verifying → verified → issuing → live), the exact DNS records
  currently expected and currently observed side by side, certificate info, health check history,
  danger zone (remove, change primary).
- The "expected vs observed" table is the single most useful debugging surface for the user and for
  support — it should be the first thing on the page when something is wrong.

### 2. Connect wizard

```
1. Enter domain          — validation, apex vs subdomain explanation, entitlement check
2. Add records           — TXT for ownership + CNAME/A for routing, registrar-specific guide,
                           copy buttons, "I've added them" (verification starts automatically anyway)
3. Verifying             — live progress per record, resolver agreement, elapsed time, what happens
                           next, "check again" (rate-limited), and permission to leave the page
4. Securing              — certificate issuance progress
5. Live                  — success state with a link, next steps (set as primary, redirect www)
```

Every step: an escape hatch to a help article, a "email me when it's done" option, and a support
contact that includes the domain and request id automatically.

### 3. Purchase wizard

```
1. Search                — availability across TLDs, price per year, renewal price, suggestions
2. Select                — term, auto-renew, WHOIS privacy (default on where allowed)
3. Registrant details    — contact form with locale-aware address input (phase 06), validation,
                           and a plain statement of what is sent to the registrar and why (phase 05)
4. Review & pay          — total, renewal terms, non-refundability notice, explicit confirmation
5. Provisioning          — registration → DNS configuration → verification → certificate, each with
                           its own progress state and failure handling
6. Live                  — success, with domain management entry points
```

### 4. Health & lifecycle

- Health badge on the domain list; degraded domains explain what changed and how to fix it.
- Expiry warnings for purchased domains (in-app + email), auto-renew toggle with billing implications
  stated, and a renewal failure state with a clear recovery path.
- Primary-domain switching with a preview of the resulting URLs and a warning about SEO/redirects.
- Removal: consequences spelled out (storefront becomes unreachable at that host), typed confirmation.

## Work breakdown

1. Domain list/detail screens with the expected-vs-observed record table.
2. Connect wizard steps, resumable state, and status polling with backoff.
3. Registrar detection → guide catalog (content + screenshots), localized, with a generic fallback.
4. Copy-to-clipboard record components with per-field and bulk copy.
5. Verification progress UI including partial propagation and conflicting-record cases.
6. Certificate issuance progress and failure states.
7. Purchase wizard: search, pricing display, registrant form, payment handoff, provisioning progress.
8. Health surfaces, expiry warnings, auto-renew management, renewal failure recovery.
9. Primary switching and removal flows with consequences.
10. E2E coverage of both wizards against a mocked backend covering every failure branch.

## Testing

- Component: every wizard step in every state (idle, waiting, partial, failed, succeeded).
- Unit: domain input validation (apex vs subdomain, punycode/IDN, trailing dot, uppercase), price
  formatting including renewal-year display, registrar detection mapping.
- E2E: connect happy path; wrong record value; conflicting existing record; verification timeout;
  purchase happy path; purchase where registration fails after payment (refund messaging);
  resume the wizard after a reload and on a second device.
- a11y: wizard is keyboard-navigable; progress changes are announced to screen readers; copy buttons
  announce success.
- i18n: Japanese guides render correctly, including registrar names and Japanese address input.

## Security

- Registrant contact data is personal data: minimal fields, clear purpose statement, and the
  sub-processor (registrar) named at the point of collection (phase 05 alignment).
- Verification tokens are displayed but never logged client-side or included in analytics events.
- No registrar credentials are ever requested for connected domains — the UI says so explicitly,
  because phishing that imitates this flow is a real risk to our users.
- Domain inputs are validated and normalised before display to prevent homograph confusion; unicode
  domains are shown with their punycode equivalent.

## Acceptance criteria

- [ ] A non-technical user connects a domain they own without contacting support, in usability testing.
- [ ] The wizard survives a page reload, a device change, and a multi-hour DNS delay.
- [ ] Every distinguishable failure has its own message and a concrete next action.
- [ ] Purchasing a domain results in a live storefront with no manual step and no surprise pricing.
- [ ] Guides exist and are correct for the top registrars in both English and Japanese markets.
- [ ] Domain health issues are surfaced proactively, not discovered by the tenant's customers.

## Risks

| Risk | Mitigation |
|---|---|
| DNS complexity overwhelms users | Registrar-specific guides, copy buttons, expected-vs-observed table, email-when-done, and a "we can help" path |
| Registrar guides go stale as UIs change | Content is data with an owner and a review date; users can report an outdated guide from the page |
| Users blame us for their registrar's propagation delay | Honest, specific progress messaging with expected timeframes |
| Purchase failures after payment | Clear refund messaging, automatic retry, support handoff with all context attached |
| Phishing imitating this flow | We never ask for registrar credentials, and we say so prominently — plus a security-awareness note in the guide |
