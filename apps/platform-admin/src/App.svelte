<script lang="ts">
import { requireAal2 } from '@sanvi/auth'
import { QueryDevtools } from '@sanvi/query'
import type { Router, RouteDefinition } from '@sanvi/spa-router'
import { createRouter } from '@sanvi/spa-router'
import { AppShell, ErrorView, Spinner } from '@sanvi/ui'

// `router` referenced inside the guard closures before assignment — see
// `@sanvi/admin`'s `App.svelte` for why this is safe.
let router: Router

// Reserved for features/plans/audit/themes/privacy — filled in by the phases that own each
// (03, 04, 05, 07, respectively). Adding a nav item and a route here is that phase's work.
//
// Every route except `login`/`step-up` requires `aal2` — platform admin is
// the one place in the workspace where signing in isn't enough on its own
// (`sanvi-frontend/docs/phase-02-auth-ux`'s acceptance criteria).
const routes: RouteDefinition[] = [
  {
    path: '',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Tenants.svelte'),
  },
  {
    path: 'operators',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Operators.svelte'),
  },
  {
    path: 'settings/security',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/SettingsSecurity.svelte'),
  },
  { path: 'login', load: () => import('./routes/Login.svelte') },
  { path: 'step-up', load: () => import('./routes/StepUp.svelte') },
  { path: 'health', load: () => import('./routes/Health.svelte') },
]

router = createRouter({
  routes,
  notFound: () => import('./routes/NotFound.svelte'),
})

const COPY = {
  brand: 'Sanvi Platform Admin',
  skipLink: 'Skip to main content',
  primaryNav: 'Primary',
  loadingLabel: 'Loading',
  errorTitle: 'Something went wrong',
  errorDescription: 'Try reloading the page.',
  deniedTitle: 'Access denied',
  deniedDescription: "You don't have permission to view this page.",
  retry: 'Try again',
}

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Tenants' },
  { href: '/operators', label: 'Operators' },
  { href: '/settings/security', label: 'Security' },
]

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
