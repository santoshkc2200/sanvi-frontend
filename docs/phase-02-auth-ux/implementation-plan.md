# Phase 02 — Authentication & Authorization UX (frontend)

**Target version:** 0.3.0
**Depends on:** frontend 01, backend 02
**Unlocks:** every authenticated screen

## Goal

An `@sanvi/auth` package that drives Ory Kratos self-service flows from our own UI — sign up, sign
in with Google, Microsoft or an email code, verify, recover, manage sessions — plus the account
linking experience, permission-aware rendering, and route guards for all four apps.

## Scope

**In**
- Kratos flow rendering (generic node renderer + hand-tuned layouts for the common flows).
- Social login buttons, email-code (passwordless) login, optional password.
- Account linking UX when a social identity collides with an existing account.
- Session store, guards, permission-aware components, member/invitation management UI.
- Security surfaces: active sessions list, sign out everywhere, security notification preferences.

**Out**
- MFA enrolment UI beyond what platform admins need (full MFA management is phase 11).
- Role *authoring* UI (phase 03).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Flow rendering | Our own UI calling Kratos self-service endpoints (browser flows), not Kratos' default UI | Branding, i18n, and theming are product requirements |
| Node rendering | A generic `KratosForm` that renders Kratos UI nodes, with per-flow overrides for layout and copy | Kratos adds/changes nodes; a generic renderer survives that, overrides make it look designed |
| Session transport | Cookies set by Kratos; never read or store tokens in JS | XSS cannot exfiltrate what JS cannot see |
| Session state | `@sanvi/auth` store hydrated from `/me` on SSR (storefront/marketing) or on boot (SPAs), refreshed on focus and on 401 | One source of truth; no per-component `whoami` calls |
| Guards | SvelteKit `load` guards for SSR apps; router guards + suspense shell for SPAs | Redirect before render, never flash protected content |
| Permission UI | `<Can permission="billing.subscription.update">` and `can(perm)`; the **backend still enforces** | Hiding a button is UX, not security — stated explicitly so nobody confuses the two |
| Error copy | Kratos error ids mapped to our localized messages, with a safe fallback | Kratos messages are not our voice and are not always translated |
| Return-to | Signed `return_to` values validated against an allow-list of our own hosts | Open redirect is the classic auth bug |

## Deliverables

### 1. `@sanvi/auth`

```ts
export const session: Readable<Session | null>       // user, memberships, aal, methods
export function can(permission: string, resource?: string): boolean
export async function startFlow(kind: 'login'|'registration'|'recovery'|'verification'|'settings')
export async function submitFlow(flow: KratosFlow, values: Record<string, unknown>)
export async function logout(everywhere?: boolean)
export function requireSession(event): Session       // load-guard helper
export function requirePermission(event, perm): void
```

Handles: flow creation and resumption (`?flow=` ids), CSRF token passthrough, `410 Gone` expired-flow
recovery (restart transparently, preserve entered values where safe), 401 → redirect with `return_to`,
and the `session_aal2_required` step-up path.

### 2. Screens

| Screen | Notes |
|---|---|
| Sign in | Social buttons (Google, Microsoft) rendered **from the flow's node list**, so adding a provider server-side needs zero frontend change; email-code as the primary fallback; password when enabled |
| Sign up | Same node-driven approach; privacy controls wired to phase 05 — consent checkboxes where the jurisdiction is opt-in, notice plus a link to privacy choices where it is notice-and-opt-out (never a checkbox that fakes consent) |
| Email code entry | 6-digit input with paste support, resend with cooldown, expiry countdown |
| Verification / recovery | Code entry + clear "check your email" state, resend throttling |
| Account linking | The dedicated flow below |
| Settings → security | Linked providers (link/unlink, with "you must keep one method" guard), password, sessions |
| Sessions | Device, IP, location hint, last seen; revoke one; sign out everywhere |
| Invitations | Accept flow for invited members, including sign-up-on-accept |
| Members (tenant) | List, invite, resend, revoke, change roles (roles authored in phase 03) |
| Step-up | Re-authentication modal for sensitive actions, returning to the original intent |

### 3. Account linking experience

When the backend returns the "identifier exists" challenge:

1. Explain plainly: *"An account already exists for `you@example.com`. Sign in to link Google to it."*
   — never "invalid credentials", which is the state of the art in confusing.
2. Offer the existing account's available methods (email code, password, another linked provider).
3. On success, show what is being linked and to which account, then confirm.
4. Success state lists all linked providers and notes that a security email was sent.
5. Abandonment is safe: no partial link, and the intent expires.

The auto-link case (both sides verified) never shows a challenge; the user just lands signed in, and
the security notification email is the audit trail.

### 4. Guards and shells

- SPA: boot → session fetch → route table filtered by permission → render. Unauthenticated users go
  to sign-in with `return_to`; unauthorized users see a 403 page explaining *which* permission is
  missing and who can grant it (that second half is what stops support tickets).
- SSR: `load` guards redirect before any protected data is fetched.
- `platform-admin` additionally requires `aal2`, prompting enrolment when absent.

## Work breakdown

1. Kratos flow client + CSRF + expiry/resume handling in `@sanvi/auth`.
2. Generic `KratosForm` node renderer + message mapping + localized copy.
3. Sign in / sign up / verification / recovery / settings screens with social + email-code.
4. Session store, hydration for SSR and SPA, focus refresh, 401 interception in `api-client`.
5. Guards, `<Can>`, permission helpers, 403 page.
6. Account-linking flow screens and states.
7. Sessions list, sign out everywhere, security notification preferences.
8. Members + invitations UI.
9. Step-up re-authentication modal and the intent-preservation mechanism.
10. E2E coverage of all of the above, including the negative paths.

## Testing

- Component: node renderer against captured Kratos flow fixtures (each method, each error state).
- Unit: `return_to` allow-list, permission evaluation, expired-flow restart, code input behaviour.
- E2E per method: Google (mocked IdP), Microsoft (mocked), email code (MailHog), password.
- E2E linking matrix mirroring the backend's: auto-link, challenge-link, refuse-link, abandon.
- Security: open-redirect attempts, CSRF token stripping, protected-route flash test (no protected
  content renders before the guard resolves), session revocation takes effect on next navigation.
- a11y: full keyboard path through sign-in and code entry; screen-reader announcement of errors.

## Security

- No tokens in JS-accessible storage; nothing sensitive in `sessionStorage`.
- CSP unchanged by auth (no third-party auth scripts; social login is a redirect, not an SDK).
- Rate-limit feedback rendered kindly but without revealing whether an account exists.
- Sign-in and sign-up render identical timing and messaging for unknown vs known emails.
- Any `{@html}` in Kratos message rendering is sanitised (Kratos messages are server-controlled, but
  the rule holds regardless).

## Acceptance criteria

- [ ] Sign in with Google, Microsoft, and email code, from all relevant apps, with branded UI.
- [ ] Adding a provider server-side makes a new button appear with **no frontend change** (verified
      with a test provider).
- [ ] The linking challenge is understandable enough that a first-time user completes it unaided in
      usability testing.
- [ ] No protected content ever renders before the guard resolves (e2e asserted).
- [ ] Sessions can be listed and revoked; revocation takes effect immediately.
- [ ] Platform admin requires MFA and prompts enrolment when missing.

## Risks

| Risk | Mitigation |
|---|---|
| Kratos node schema changes break custom UI | Generic renderer + fixture-based tests pinned to the Kratos version; overrides are cosmetic only |
| Flow expiry produces dead ends | Transparent restart with preserved safe values, plus an explicit "start over" affordance |
| Users misread linking as a security incident | Clear copy, the account's own email shown, and a confirmation email that explains what happened |
| Permission-hidden UI mistaken for security | Documented in `CONTRIBUTING.md`; every guarded action has a backend permission test in the same PR |
