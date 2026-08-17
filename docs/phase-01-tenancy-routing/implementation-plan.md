# Phase 01 — Tenancy, Routing & API Client (frontend)

**Target version:** 0.2.0
**Depends on:** frontend 00, backend 01
**Unlocks:** every tenant-scoped screen

## Goal

The storefront knows which tenant it is serving before it renders a byte, the admin apps know which
tenant the user is acting on, and all four apps talk to the backend through one generated, typed
client that cannot forget the tenant header or mishandle an error.

## Scope

**In**
- `@sanvi/api-client`: OpenAPI generation + runtime (auth, tenant, retries, problem+json, request id).
- `@sanvi/tenant`: tenant context resolution (SSR + SPA), tenant switcher, entitlement stub.
- Storefront request pipeline: `handle` hook resolving tenant from host → `locals` → `load`.
- Routing structure for all four apps, including the not-found/suspended/degraded tenant states.
- Query layer: caching, dedupe, invalidation, optimistic updates.

**Out**
- Auth (phase 02) — until then the admin apps run against a dev-only impersonation header.
- Theme and locale resolution hooks (phases 06/07) — the hook order is reserved for them now.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Client generation | `openapi-typescript` types + a hand-written fetch runtime | Generated types with a runtime we control beats a fully generated client we cannot shape |
| Generation timing | CI job pulls the backend spec and regenerates; drift fails the build | The contract stays honest without manual copying |
| Tenant on the storefront | Resolved server-side from the `Host` header in `hooks.server.ts`, put in `event.locals`, passed through `load` | The tenant must be known before SSR; the browser never decides it |
| Tenant in admin apps | From the session's memberships; explicit switcher; the selected tenant is sent as a header on every request | Staff can belong to several tenants |
| Query layer | Small purpose-built store layer over `api-client` (~200 LOC) rather than a large data-fetching dependency | SvelteKit `load` already does most of it; we only need cache + invalidation |
| Error surface | Typed `ApiError` with `problem.type` → localized message map, plus a "something went wrong" fallback with a trace id the user can quote | Support needs the trace id; users need a sentence |
| Suspended tenant | Dedicated `423` screen with billing link; storefront shows a neutral maintenance page | A suspended tenant's customers should not see an error stack |

## Deliverables

### 1. `@sanvi/api-client`

```ts
// generated: types.ts (from api/*.yaml)   hand-written: runtime
export interface ApiClientOptions {
  baseUrl: string
  fetch?: typeof fetch                  // SvelteKit's event.fetch on the server
  tenant?: () => string | undefined     // tenant id/slug header provider
  onUnauthorized?: () => void           // hooked to auth in phase 02
  locale?: () => string                 // Accept-Language, phase 06
}
export class ApiError extends Error {
  status: number; type: string; title: string; detail?: string
  traceId?: string; errors?: FieldErrors  // field-level validation for forms
}
```

Behaviour: request id per call, `Accept-Language`, tenant header, timeout, retry on idempotent verbs
with jitter, single-flight dedupe of identical in-flight GETs, `Idempotency-Key` on mutations that
declare it, problem+json parsing, and typed field errors surfaced to `@sanvi/forms`.

SSR note: on the server the client uses SvelteKit's `event.fetch` so cookies and internal routing
work; in the browser it uses the global. One factory, two adapters, no branching in call sites.

### 2. `@sanvi/tenant`

```ts
export interface TenantContext {
  id: string; slug: string; displayName: string
  status: 'active' | 'suspended' | 'provisioning'
  defaultLocale: string; region: string
  entitlements: Record<string, { enabled: boolean; limit?: number }>  // filled in phase 03
}
export const tenant: Readable<TenantContext | null>
export function requireTenant(): TenantContext            // throws → error boundary
export function hasFeature(key: string): boolean          // phase 03 makes it real
```

Storefront: `hooks.server.ts` resolves `Host` → `GET /public/tenant-context` (cached per host with a
short TTL and stale-while-revalidate) → `event.locals.tenant` → root `layout.server.ts` exposes it.
Unknown host → 404 page (never an error trace); suspended → maintenance page.

Admin: tenant list from the session; switcher persists the selection in a cookie; switching clears
the query cache to avoid cross-tenant data bleeding into the UI.

### 3. Routing structure

```
apps/storefront/src/routes/
  +layout.server.ts        # tenant, (later) theme + locale
  +layout.svelte           # themed shell
  +page.svelte             # tenant home
  [...catchall]/           # theme-driven pages (phase 07)
  maintenance/  not-found/

apps/admin/src/routes/
  (auth)/                  # phase 02
  (app)/
    dashboard/  settings/  members/  billing/  domains/  payments/  ads/   # filled by later phases
apps/platform-admin/src/routes/
  (app)/ tenants/  features/  plans/  audit/  themes/  privacy/
```

Route-level code splitting; a shared `AppShell` (nav, breadcrumb, tenant switcher, user menu) in `ui`.

### 4. Query layer

`createQuery(key, fetcher, { staleTime, tags })` and `createMutation(fn, { invalidates })`.
Cache keyed by `(tenantId, key)` so a tenant switch cannot serve another tenant's cached data —
enforced by construction, not by discipline. `invalidate(tag)` after mutations; optimistic updates
opt-in with rollback on error.

## Work breakdown

1. OpenAPI generation script + CI drift check + type export map.
2. `api-client` runtime: transport, errors, retries, dedupe, headers, SSR fetch adapter.
3. `tenant` package: types, stores, resolution helpers, switcher component.
4. Storefront `hooks.server.ts` chain with reserved slots for locale (06) and theme (07).
5. Host-resolution cache with stale-while-revalidate and negative caching for unknown hosts.
6. Admin/platform-admin shells, navigation, tenant switcher, cache reset on switch.
7. Query/mutation layer + devtools panel (dev-only) showing cache state and in-flight requests.
8. Error boundaries, 404/423/500 pages, trace-id display, retry affordances.
9. E2E: host → tenant rendering, unknown host, suspended tenant, tenant switch isolation.

## Testing

- Unit: header assembly, retry/backoff, problem+json parsing, field-error mapping, dedupe.
- Component: tenant switcher, error boundary states, maintenance page.
- Contract: generated types compile against recorded API responses; a deliberate spec change breaks
  the build (proving the gate works).
- E2E: `acme.localhost` renders Acme, `unknown.localhost` renders 404, switching tenants in admin
  never shows the previous tenant's rows (explicit assertion, not a vibe check).
- SSR: no tenant data leaks between concurrent server requests (parallel-request test).

## Security

- The tenant header is a *hint* for admin apps; the backend always re-derives authority from the
  session. The frontend never treats it as an authorization boundary.
- No tenant data in `localStorage`; caches are in-memory and cleared on switch and on logout.
- Unknown hosts return a generic 404 with no tenant enumeration signal.

## Acceptance criteria

- [ ] Storefront resolves the tenant server-side and renders tenant-specific content on first paint.
- [ ] Every API call in every app goes through `api-client` (lint gate green).
- [ ] Spec drift between backend and frontend fails CI.
- [ ] Tenant switching in admin produces no cross-tenant data in the UI (e2e asserted).
- [ ] Suspended and unknown tenants render their dedicated pages, not errors.

## Risks

| Risk | Mitigation |
|---|---|
| Host-resolution latency on every SSR request | Short-TTL cache with stale-while-revalidate + negative cache; backend caches it too |
| Generated types churn on every backend PR | Generation pinned to the merged spec; breaking changes surface as compile errors, which is the point |
| Query cache leaks across tenants | Tenant id is part of every cache key by construction; cache cleared on switch; e2e test guards it |
| Reserved hook slots get filled ad hoc later | Hook order documented and unit-tested now, so phases 06/07 slot in without a rewrite |
