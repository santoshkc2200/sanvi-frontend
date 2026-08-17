# Phase 03 — Platform Admin & Tenant Admin Consoles (frontend)

**Target version:** 0.4.0
**Depends on:** frontend 01, 02; backend 03
**Unlocks:** operating the product without a database client

## Goal

Two consoles that make the control plane usable: `platform-admin` for Sanvi operators (tenants,
features, entitlements, roles, audit, impersonation) and `admin` for tenant staff (their own
settings, members, roles, usage). Both are built from the same `ui` package with the same data
patterns, so the second console costs a fraction of the first.

## Scope

**In**
- Platform admin: tenant list/detail, lifecycle actions, entitlement management, feature catalog,
  audit log viewer, impersonation, four-eyes approvals.
- Tenant admin: dashboard, tenant settings, member/role management, custom role authoring, usage and
  quota visibility.
- The shared "admin kit": data table, filter bar, detail layout, dangerous-action patterns, audit
  trail viewer, saved views.

**Out**
- Billing screens (phase 04), domains (08), payments (09), ads (10) — their nav slots are reserved
  and render "coming soon" behind feature flags.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Shared admin kit in `@sanvi/ui` | Data table, filters, detail shell, and action patterns are one implementation used by both consoles | Two consoles, one set of behaviours; consistency is free instead of expensive |
| Table strategy | Server-driven: cursor pagination, server filtering/sorting, column config client-side | Tenant lists grow; client-side filtering breaks at exactly the moment it matters |
| Dangerous actions | A single `DangerousAction` component: explicit consequence text, typed confirmation for the worst cases, reason capture, optional step-up auth, and an undo window where the backend supports it | These actions are where operator mistakes become incidents |
| Impersonation | Persistent, unmissable banner (colour-inverted top bar) with target, remaining time, and a one-click exit; read-only mode visually distinct | Nobody should ever forget they are impersonating |
| Optimistic updates | Only for reversible, idempotent actions; never for entitlements or lifecycle changes | A wrong optimistic state on a billing-adjacent screen destroys trust |
| Permission-driven nav | Nav and actions render from the permission set; unavailable actions are shown disabled with a "why" tooltip rather than hidden, where discoverability helps | Hidden features generate support tickets; disabled+explained does not |

## Deliverables

### 1. Admin kit (`@sanvi/ui`)

- `DataTable`: server pagination, sort, column visibility/order persistence, row selection, bulk
  actions with a confirmation summary, empty/error/loading states, keyboard navigation, CSV export.
- `FilterBar`: typed filters (text, select, date range, boolean), URL-synced so views are shareable
  and back/forward works, saved views per user.
- `DetailShell`: header with status, primary/secondary actions, tab strip, side metadata panel.
- `AuditTrail`: chronological entries with actor, action, before/after diff viewer, filters.
- `DangerousAction`, `ReasonPrompt`, `StepUpGate`, `ApprovalRequest` components.
- `StatCard`, `UsageMeter` (quota vs limit with threshold colouring from tokens).

### 2. Platform admin console

| Screen | Contents |
|---|---|
| Tenants | Searchable table: slug, name, status, plan (04), region, created, MRR (04), last activity |
| Tenant detail | Overview, members, entitlements, subscription (04), domains (08), audit, danger zone |
| Entitlements | Per-tenant grid of features with source badges (override / subscription / plan / default), inline grant with reason + expiry, bulk grant across tenants |
| Feature catalog | CRUD for features: key, kind (boolean/quota), defaults, visibility, deprecation |
| Roles & permissions | Platform role management; permission registry browser grouped by context |
| Audit | Global audit search with filters, diff view, export, chain-verification status indicator |
| Impersonation | Start (reason + duration + read-only toggle + step-up), active sessions list, force-end |
| Approvals | Pending four-eyes requests, approve/reject with reason |

### 3. Tenant admin console

| Screen | Contents |
|---|---|
| Dashboard | Status, usage meters against quotas, quick actions, recent activity, onboarding checklist |
| Settings | Name, default locale (06), timezone, region (read-only), branding entry point (07) |
| Members | Invite, resend, revoke, change roles, last active; bulk invite via CSV |
| Roles | System roles (read-only) + custom role authoring: permission picker grouped by context, with permissions the actor lacks visibly disabled and explained |
| Usage | Quota consumption over time, limit warnings, upgrade CTA (wired in 04) |
| Activity | Tenant-scoped audit trail |

### 4. Onboarding checklist

A progress component on the tenant dashboard that later phases plug into: connect a domain (08),
connect payments (09), choose a theme (07), invite a teammate, complete billing (04). Each item
declares its own completion query, so adding one is a registration, not a redesign.

## Work breakdown

1. Admin kit components with stories, tests, and axe coverage.
2. URL-synced filter/sort/pagination utilities shared by both consoles.
3. Platform admin: tenants list/detail, lifecycle actions with reasons and confirmations.
4. Entitlement management UI incl. source precedence display and expiry.
5. Feature catalog CRUD.
6. Audit viewer with diffs and export.
7. Impersonation start/exit, banner, read-only visual mode, forced expiry countdown.
8. Four-eyes approval queue.
9. Tenant admin: dashboard, settings, members, custom roles, usage.
10. Onboarding checklist registry + the first items.
11. E2E journeys for both consoles.

## Testing

- Component: table states (empty/loading/error/partial), bulk actions, filter URL round-trip,
  dangerous-action confirmation paths, permission-disabled rendering.
- Unit: permission-picker escalation guard (cannot select what the actor lacks), quota meter
  thresholds, diff rendering of nested JSON.
- E2E: grant an entitlement and see the tenant's gate flip; author a custom role and assign it;
  impersonate, observe the banner, be forcibly returned at expiry.
- a11y: full keyboard operation of the data table and dialogs; screen-reader labels for status chips
  and bulk-selection announcements.
- Visual regression on the impersonation banner (it must be impossible to miss, and must survive
  theme changes).

## Security

- Every action re-checks permissions server-side; the console never assumes its own nav is authority.
- Impersonation banner cannot be dismissed and is rendered in the app shell, not per route.
- Audit export is permission-gated and logged (exporting the audit log is itself auditable).
- Reason fields are required, length-validated, and stored server-side, never only client-side.
- Platform admin app enforces `aal2` on boot and on every sensitive action.

## Acceptance criteria

- [ ] An operator can find a tenant, understand its state, and change an entitlement in under a
      minute, with the reason captured.
- [ ] A tenant admin can author a custom role and cannot escalate beyond their own permissions.
- [ ] Impersonation is visually unmistakable, time-boxed, and exits cleanly.
- [ ] Every table view is shareable by URL and restores exactly.
- [ ] Both consoles pass axe with zero serious/critical issues and full keyboard operation.

## Risks

| Risk | Mitigation |
|---|---|
| Two consoles diverge in behaviour and quality | Shared admin kit; a component only lands in an app if it is genuinely app-specific |
| Operators make destructive mistakes | Consequence-explicit confirmations, reasons, step-up, four-eyes for the worst, undo windows where possible |
| Table performance with tens of thousands of rows | Server-driven everything, virtualised rows, capped page sizes |
| Nav slots for later phases rot | Slots are feature-flagged and render an explicit "not enabled" state, tested |
