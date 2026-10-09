<script lang="ts">
import { requireAal2 } from '@sanvi/auth'
import { listImpersonations } from '@sanvi/api-client'
import { currentLocale, localeOptions, onLocaleChange, setLocale, t } from '@sanvi/i18n'
import { clearCache, QueryDevtools } from '@sanvi/query'
import { handleLinkClick } from '@sanvi/spa-router'
import type { Router, RouteDefinition } from '@sanvi/spa-router'
import { createRouter } from '@sanvi/spa-router'
import {
  AppShell,
  AsyncBoundary,
  Cluster,
  ErrorView,
  LocaleSwitcher,
  Spinner,
  ToastViewport,
} from '@sanvi/ui'
import { apiClient } from './lib/api'
import { setPlatformAdminTelemetryRouteSource } from './lib/telemetry'
import {
  buildDiagnosticsPaste,
  errorTraceId,
  recentBreadcrumbs,
  recordDiagnosticBreadcrumb,
} from '@sanvi/telemetry/diagnostics'

// `router` referenced inside the guard closures before assignment — see
// `@sanvi/admin`'s `App.svelte` for why this is safe.
// svelte-ignore non_reactive_update
let router: Router

// Reserved for plans/themes/privacy — filled in by the phases that own each
// (04, 07, 05, respectively). Adding a nav item and a route here is that phase's work.
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
    // Not nested under the `''` route above as a `children` entry — a child
    // of an empty-path parent inherits an empty segment prefix, so `:id`
    // alone would match ANY single top-level segment (e.g. `/does-not-exist`)
    // instead of only `/tenants/:id`. A flat multi-segment `path` sidesteps
    // that entirely (`flatten` splits on `/` regardless of nesting).
    path: 'tenants/:id',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/TenantDetail.svelte'),
  },
  {
    path: 'features',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Features.svelte'),
  },
  {
    path: 'roles',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Roles.svelte'),
  },
  {
    path: 'audit',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Audit.svelte'),
  },
  {
    path: 'impersonations',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Impersonation.svelte'),
  },
  {
    path: 'approvals',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Approvals.svelte'),
  },
  {
    path: 'privacy',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Privacy.svelte'),
  },
  {
    path: 'settings/security',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/SettingsSecurity.svelte'),
  },
  {
    // Phase 06 deliverable — the console that edits the platform-wide
    // catalog overrides the backend merges over its static catalogs.
    path: 'translations',
    guard: (params) => requireAal2(router)(params),
    load: () => import('./routes/Translations.svelte'),
  },
  { path: 'login', load: () => import('./routes/Login.svelte') },
  { path: 'step-up', load: () => import('./routes/StepUp.svelte') },
  { path: 'health', load: () => import('./routes/Health.svelte') },
]

router = createRouter({
  routes,
  notFound: () => import('./routes/NotFound.svelte'),
})

// Telemetry segments by the matched route pattern, not the raw path — ids in
// the path would give every visit its own bucket. A null pattern (not-found)
// falls back to the raw path.
setPlatformAdminTelemetryRouteSource(() => router.pattern ?? router.pathname)

// Navigation breadcrumbs for the copy-diagnostics paste (FR-1106). Local
// recall only — nothing transmits unless the error tracker is enabled and
// the directive gate allows it. Route patterns, not raw paths.
$effect(() => {
  const pattern = router.pattern
  if (pattern) recordDiagnosticBreadcrumb('navigation', pattern)
})

// A navigation gives the panel boundary a clean slate — the previous page's
// crash is not this page's failure.
$effect(() => {
  void router.pattern
  panelError = null
})

// The route-error screen carries its correlation (FR-1106): the trace id of
// the failing ApiError, falling back to "the request this page last made"
// for non-API failures, plus the one-paste diagnostics. Platform-admin has
// no tenant dimension — that section reports `none`.
const routeErrorTraceId = $derived(errorTraceId(router.error) ?? apiClient.getLastTraceId())
const routeErrorDiagnostics = $derived(
  routeErrorTraceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
        // Route stays a pattern — the raw pathname carries ids (the
        // DiagnosticsFields contract), so an unmatched route reports `none`.
        route: router.pattern ?? '',
        tenantId: null,
        locale: currentLocale(),
        traceId: routeErrorTraceId,
        breadcrumbs: recentBreadcrumbs(),
      })
    : undefined,
)

// TASK-023 step 3: the panel boundary's own correlation — a crash inside a
// rendered page never reaches `router.error`. Cleared on navigation.
let panelError = $state<unknown>(null)
const panelTraceId = $derived(errorTraceId(panelError) ?? apiClient.getLastTraceId())
const panelDiagnostics = $derived(
  panelTraceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
        route: router.pattern ?? '',
        tenantId: null,
        locale: currentLocale(),
        traceId: panelTraceId,
        breadcrumbs: recentBreadcrumbs(),
      })
    : undefined,
)

// `$derived` — the labels go through `t` and must survive a locale switch.
const NAV = $derived<{ href: string; label: string }[]>([
  { href: '/', label: t['platform.nav.tenants']() },
  { href: '/features', label: t['platform.nav.features']() },
  { href: '/roles', label: t['platform.nav.roles']() },
  { href: '/audit', label: t['platform.nav.audit']() },
  { href: '/impersonations', label: t['platform.nav.impersonation']() },
  { href: '/approvals', label: t['platform.nav.approvals']() },
  { href: '/privacy', label: t['platform.nav.privacy']() },
  { href: '/settings/security', label: t['platform.nav.security']() },
  { href: '/translations', label: t['platform.nav.translations']() },
])

// Best-effort operator awareness, not the "you are now browsing as this
// user" banner the phase-03 plan describes — that needs the impersonated
// *session itself* to know it's impersonated (an `on_behalf_of`/similar
// field on `/me`), which the current API doesn't expose. This is the
// honest version buildable today: how many grants are live right now,
// fetched on boot and re-checked on every navigation (force-ending a grant
// on the Impersonation screen must update the banner immediately).
let activeImpersonations = $state<{ id: string; expiresAt: string }[]>([])

async function loadActiveImpersonations(): Promise<void> {
  try {
    const grants = await listImpersonations(apiClient)
    const now = Date.now()
    activeImpersonations = grants
      .filter((grant) => !grant.revoked_at && new Date(grant.expires_at).getTime() > now)
      .map((grant) => ({ id: grant.id, expiresAt: grant.expires_at }))
  } catch {
    // Not fatal — the banner is a convenience, not the enforcement.
  }
}

// The countdown must tick: derive from a `now` that advances, not from
// `Date.now()` read once per derivation.
let now = $state(Date.now())

$effect(() => {
  const timer = window.setInterval(() => {
    now = Date.now()
  }, 30_000)
  return () => window.clearInterval(timer)
})

$effect(() => {
  // Re-check on every navigation so a force-end elsewhere in the console
  // clears the banner without a full reload.
  void router.pathname
  void loadActiveImpersonations()
})

const soonestExpiryMinutes = $derived.by(() => {
  if (activeImpersonations.length === 0) return 0
  const soonest = Math.min(
    ...activeImpersonations.map((grant) => new Date(grant.expiresAt).getTime()),
  )
  return Math.max(0, Math.round((soonest - now) / 60_000))
})

function retry(): void {
  router.navigate(router.pathname)
}

// Phase 06: locale switching for the operator console — the switcher lives
// in the shell header; cached locale-dependent data refetches on change.
async function switchLocale(code: string): Promise<void> {
  await setLocale(code)
}
onLocaleChange(() => clearCache())
</script>

{#if activeImpersonations.length > 0}
  <div class="sanvi-impersonation-banner" role="status">
    <span>
      {t['platform.app.impersonationBanner']({
        count: activeImpersonations.length,
        minutes: soonestExpiryMinutes,
      })}
    </span>
    <a href="/impersonations" onclick={(event) => handleLinkClick(event, '/impersonations')}>
      {t['platform.app.impersonationBannerLink']()}
    </a>
  </div>
{/if}
<AppShell
  brand={t['platform.app.brand']()}
  skipLinkLabel={t['platform.app.skipLink']()}
  primaryNavLabel={t['platform.app.primaryNav']()}
  nav={NAV}
  currentPath={router.pathname}
  onNavigate={router.handleLinkClick}
  prefetch={router.prefetch}
>
  {#snippet headerExtra()}
    <LocaleSwitcher
      options={localeOptions().map((o) => ({ code: o.code, label: o.label }))}
      current={currentLocale()}
      label={t['common.nav.switchLanguage']()}
      onSwitch={(code) => void switchLocale(code)}
    />
  {/snippet}
  {#if router.error}
    <ErrorView
      title={t['errors.generic.title']()}
      description={t['errors.default.description']()}
      retryLabel={t['common.retry']()}
      onRetry={retry}
      traceLine={routeErrorTraceId ? t['errors.traceId']({ id: routeErrorTraceId }) : undefined}
      diagnosticsText={routeErrorDiagnostics}
      copyLabel={t['errors.diagnostics.copy']()}
      copiedLabel={t['errors.diagnostics.copied']()}
    />
  {:else if router.guardRejected}
    <ErrorView
      title={t['platform.app.deniedTitle']()}
      description={t['platform.app.deniedDescription']()}
    />
  {:else if router.component}
    {@const Page = router.component}
    <!-- `{#key}` forces a full unmount/remount when the route changes to a
         different component — without it Svelte keeps the previous route's
         instance mounted (and its own internal effects/state) instead of
         swapping to the new one, since `<Page />` alone doesn't get treated
         as a fresh element identity just because `Page`'s value changed. -->
    {#key Page}
      <AsyncBoundary
        title={t['platform.app.panelErrorTitle']()}
        description={t['platform.app.panelErrorDescription']()}
        retryLabel={t['common.retry']()}
        onRetry={() => retry()}
        onError={(error) => {
          panelError = error
        }}
        traceLine={panelTraceId ? t['errors.traceId']({ id: panelTraceId }) : undefined}
        diagnosticsText={panelDiagnostics}
        copyLabel={t['errors.diagnostics.copy']()}
        copiedLabel={t['errors.diagnostics.copied']()}
      >
        <Page {...router.params} />
      </AsyncBoundary>
    {/key}
  {:else if router.loading}
    <Spinner label={t['common.loading']()} />
  {/if}
</AppShell>
<ToastViewport />
<QueryDevtools />

<style>
  .sanvi-impersonation-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    background: var(--sanvi-color-solid-warning-base);
    color: var(--sanvi-color-text-inverse);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-impersonation-banner a {
    color: inherit;
    text-decoration: underline;
  }
</style>
