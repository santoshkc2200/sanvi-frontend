<script lang="ts">
import { buildDiagnosticsPaste, recentBreadcrumbs } from '@sanvi/telemetry/diagnostics'
import { currentLocale, t } from '@sanvi/i18n'
import { Container, EmptyState, ErrorDiagnostics } from '@sanvi/ui'
import { page } from '$app/state'

const titleSuffix = 'Sanvi'

const title = $derived(
  page.status === 404 ? t['errors.notFound.title']() : t['errors.generic.title'](),
)
const description = $derived(page.error?.message ?? t['errors.default.description']())
const traceId = $derived(page.error?.traceId)
// The marketing site is prerendered and talks to no API while rendering, so
// a trace id is genuinely absent on almost every error here — the block
// then renders nothing at all rather than a correlation it cannot keep.
const diagnosticsText = $derived(
  traceId
    ? buildDiagnosticsPaste({
        release: __APP_BUILD__,
        // Route stays a pattern — the raw pathname carries ids (the
        // DiagnosticsFields contract), so an unmatched route reports `none`.
        route: page.route.id ?? '',
        tenantId: null,
        locale: currentLocale(),
        traceId,
        breadcrumbs: recentBreadcrumbs(),
      })
    : undefined,
)
</script>

<svelte:head>
  <title>{page.status} — {titleSuffix}</title>
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
