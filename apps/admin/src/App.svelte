<script lang="ts">
import {
  getLastDeniedPermission,
  getSession,
  onSessionChange,
  requirePermission,
  requireSession,
} from '@sanvi/auth'
import { listTenantEntitlements } from '@sanvi/api-client'
import { clearCache, QueryDevtools } from '@sanvi/query'
import type { Router, RouteDefinition } from '@sanvi/spa-router'
import { createRouter } from '@sanvi/spa-router'
import { AppShell, ErrorView, Spinner, TenantSwitcher, ToastViewport } from '@sanvi/ui'
import {
  getActiveTenantId,
  getMemberships,
  onTenantSwitch,
  setEntitlements,
  setMemberships,
  switchTenant,
} from '@sanvi/tenant'
import type { TenantMembership } from '@sanvi/tenant'
import { apiClient } from './lib/api'

// `router` is referenced inside the guard closures below before it's
// assigned — safe because a guard only ever runs once something navigates,
// which can't happen before `createRouter` returns. Wrapping each in an
// extra arrow (`(params) => requireSession(router)(params)`) defers the
// `router` read to call time instead of route-array-construction time.
// Assigned exactly once below, never reassigned — every template read of
// `router.pathname`/`.component`/etc. reacts through the `Router` instance's
// own internal `$state`, not through this binding, so it doesn't need to be
// reactive itself.
// svelte-ignore non_reactive_update
let router: Router

// Reserved for billing/domains/ads — filled in by the phases that own each
// (04, 08, 10 respectively). Adding a nav item and a route here is that
// phase's work.
const routes: RouteDefinition[] = [
  {
    path: '',
    guard: (params) => requireSession(router)(params),
    load: () => import('./routes/Dashboard.svelte'),
  },
  {
    path: 'settings',
    guard: (params) => requireSession(router)(params),
    load: () => import('./routes/Settings.svelte'),
  },
  {
    path: 'settings/security',
    guard: (params) => requireSession(router)(params),
    load: () => import('./routes/SettingsSecurity.svelte'),
  },
  {
    path: 'members',
    // The tenant id must be read when the guard *runs*, not when the route
    // array is built — a multi-membership operator switching tenants must
    // be checked against the active tenant's permissions, not the first
    // membership in the session.
    guard: (params) =>
      requirePermission(router, 'identity.member.read', getActiveTenantId())(params),
    load: () => import('./routes/Members.svelte'),
  },
  {
    path: 'roles',
    guard: (params) => requirePermission(router, 'access.role.read', getActiveTenantId())(params),
    load: () => import('./routes/Roles.svelte'),
  },
  {
    path: 'usage',
    guard: (params) => requireSession(router)(params),
    load: () => import('./routes/Usage.svelte'),
  },
  {
    path: 'payments',
    guard: (params) => requirePermission(router, 'payments.read', getActiveTenantId())(params),
    load: () => import('./routes/PaymentsSettings.svelte'),
  },
  { path: 'login', load: () => import('./routes/Login.svelte') },
  { path: 'health', load: () => import('./routes/Health.svelte') },
]

router = createRouter({
  routes,
  notFound: () => import('./routes/NotFound.svelte'),
})

// Tenant data cached under the previous tenant's id must never render while
// the switcher shows the new tenant — clearing on every switch is the
// enforcement, not a "remember to invalidate the right tags" convention.
onTenantSwitch(() => clearCache())

// `main.ts` awaits `bootSession` before mounting, so `getSession()` already
// has real data on first render — this just keeps `@sanvi/tenant`'s
// membership list in sync for the lifetime of the tab (login/logout/401
// refresh all funnel through `onSessionChange`). Replaces the
// `dev-memberships.ts` stand-in `@sanvi/tenant` shipped with in phase 01.
function syncMemberships(session: ReturnType<typeof getSession>): void {
  const memberships: TenantMembership[] = (session?.memberships ?? []).map((membership) => ({
    tenantId: membership.tenant_id,
    slug: membership.tenant_slug,
    displayName: membership.tenant_name,
    // Role *names* aren't resolved here (would need a per-tenant roles
    // fetch just for a header dropdown) — `Members.svelte` resolves real
    // names where it matters. This is a placeholder, not used by
    // `TenantSwitcher` itself today.
    role: membership.role_ids.join(','),
  }))
  setMemberships(memberships)
}
syncMemberships(getSession())
onSessionChange(syncMemberships)

// Real entitlements, replacing the always-available stub `@sanvi/tenant`
// shipped with before phase 03. Re-synced on every tenant switch, same as
// the cache clear above — a feature gate must never read the previous
// tenant's entitlements while the switcher shows the new one.
let entitlementsSyncSeq = 0
async function syncEntitlements(): Promise<void> {
  const seq = ++entitlementsSyncSeq
  // Fail closed while refetching: between the switch and the response, the
  // previous tenant's grants must not answer `hasFeature` for the new one.
  setEntitlements([])
  try {
    const entitlements = await listTenantEntitlements(apiClient)
    if (seq !== entitlementsSyncSeq) return // a newer switch/boot superseded this response
    setEntitlements(entitlements.map((e) => ({ feature: e.feature, enabled: e.enabled })))
  } catch {
    // No session yet, or the fetch failed (network, 403, feature-gate route
    // disabled) — either way the store stays empty: unavailable, never the
    // previous tenant's grants.
  }
}
void syncEntitlements()
onTenantSwitch(() => void syncEntitlements())

const COPY = {
  brand: 'Sanvi Admin',
  skipLink: 'Skip to main content',
  primaryNav: 'Primary',
  tenantSwitcherLabel: 'Switch tenant',
  loadingLabel: 'Loading',
  errorTitle: 'Something went wrong',
  errorDescription: 'Try reloading the page.',
  deniedTitle: 'Access denied',
  deniedDescription: "You don't have permission to view this page.",
  deniedDescriptionWithPermission: (permission: string) =>
    `You don't have the "${permission}" permission. Ask a tenant owner or admin to grant it.`,
  retry: 'Try again',
}

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/members', label: 'Members' },
  { href: '/roles', label: 'Roles' },
  { href: '/usage', label: 'Usage' },
  { href: '/payments', label: 'Payments' },
  { href: '/settings', label: 'Settings' },
  { href: '/settings/security', label: 'Security' },
]

const membershipOptions = $derived(
  getMemberships().map((membership) => ({
    tenantId: membership.tenantId,
    label: membership.displayName,
  })),
)

const deniedDescription = $derived(
  getLastDeniedPermission()
    ? COPY.deniedDescriptionWithPermission(getLastDeniedPermission() as string)
    : COPY.deniedDescription,
)

function retry(): void {
  router.navigate(router.pathname)
}
</script>

<AppShell
  brand={COPY.brand}
  skipLinkLabel={COPY.skipLink}
  primaryNavLabel={COPY.primaryNav}
  nav={NAV}
  currentPath={router.pathname}
  onNavigate={router.handleLinkClick}
>
  {#snippet headerExtra()}
    <TenantSwitcher
      options={membershipOptions}
      activeTenantId={getActiveTenantId()}
      label={COPY.tenantSwitcherLabel}
      onSwitch={switchTenant}
    />
  {/snippet}

  {#if router.error}
    <ErrorView
      title={COPY.errorTitle}
      description={COPY.errorDescription}
      retryLabel={COPY.retry}
      onRetry={retry}
    />
  {:else if router.guardRejected}
    <ErrorView title={COPY.deniedTitle} description={deniedDescription} />
  {:else if router.component}
    {@const Page = router.component}
    {#key Page}
      <Page {...router.params} />
    {/key}
  {:else if router.loading}
    <Spinner label={COPY.loadingLabel} />
  {/if}
</AppShell>
<ToastViewport />
<QueryDevtools />
