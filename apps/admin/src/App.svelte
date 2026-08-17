<script lang="ts">
import { clearCache, QueryDevtools } from '@sanvi/query'
import type { RouteDefinition } from '@sanvi/spa-router'
import { createRouter } from '@sanvi/spa-router'
import { AppShell, ErrorView, Spinner, TenantSwitcher } from '@sanvi/ui'
import { getActiveTenantId, getMemberships, onTenantSwitch, switchTenant } from '@sanvi/tenant'

// Reserved for members/billing/domains/payments/ads — filled in by the phases that own each
// (03, 04, 08, 09, 10 respectively). Adding a nav item and a route here is that phase's work.
const routes: RouteDefinition[] = [
  { path: '', load: () => import('./routes/Dashboard.svelte') },
  { path: 'settings', load: () => import('./routes/Settings.svelte') },
  { path: 'health', load: () => import('./routes/Health.svelte') },
]

const router = createRouter({
  routes,
  notFound: () => import('./routes/NotFound.svelte'),
})

// Tenant data cached under the previous tenant's id must never render while
// the switcher shows the new tenant — clearing on every switch is the
// enforcement, not a "remember to invalidate the right tags" convention.
onTenantSwitch(() => clearCache())

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
  retry: 'Try again',
}

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
]

const membershipOptions = $derived(
  getMemberships().map((membership) => ({
    tenantId: membership.tenantId,
    label: membership.displayName,
  })),
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
    <ErrorView title={COPY.deniedTitle} description={COPY.deniedDescription} />
  {:else if router.component}
    {@const Page = router.component}
    <Page />
  {:else if router.loading}
    <Spinner label={COPY.loadingLabel} />
  {/if}
</AppShell>
<QueryDevtools />
