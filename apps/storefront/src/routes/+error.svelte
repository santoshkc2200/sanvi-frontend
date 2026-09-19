<script lang="ts">
import { buildDiagnosticsPaste, recentBreadcrumbs } from '@sanvi/telemetry/diagnostics'
import { currentLocale, t } from '@sanvi/i18n'
import { Container, EmptyState, ErrorDiagnostics } from '@sanvi/ui'
import { page } from '$app/state'

const title = $derived(
  page.status === 404 ? t['errors.notFound.title']() : t['errors.generic.title'](),
)
const description = $derived(page.error?.message ?? t['errors.default.description']())
const traceId = $derived(page.error?.traceId)
// The one paste (FR-1106): built from the same facts the screen renders, so
// what support receives is what the user saw. Only rendered when a trace id
// exists — a plain not-found has nothing to correlate, and a paste without
// an id would promise a correlation it cannot keep.
const diagnosticsText = $derived(
  traceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
        route: page.route.id ?? page.url.pathname,
        tenantId: null,
        locale: currentLocale(),
        traceId,
        breadcrumbs: recentBreadcrumbs(),
      })
    : undefined,
)
</script>

<svelte:head>
  <title>{page.status} — {t['errors.brand']()}</title>
</svelte:head>

<Container size="md" padding="6">
  <EmptyState {title} {description}>
    {#snippet action()}
      <a href={page.url.pathname}>{t['common.retry']()}</a>
    {/snippet}
  </EmptyState>
  <ErrorDiagnostics
    traceLine={traceId ? t['errors.traceId']({ id: traceId }) : undefined}
    {diagnosticsText}
    copyLabel={t['errors.diagnostics.copy']()}
    copiedLabel={t['errors.diagnostics.copied']()}
  />
</Container>
