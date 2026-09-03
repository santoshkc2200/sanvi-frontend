<script lang="ts">
import { ApiError, listAdPlatforms } from '@sanvi/api-client'
import type { PlatformView } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import { Alert, Button, Container, EmptyState, Spinner, Stack, UpgradePrompt } from '@sanvi/ui'
import { apiClient } from '../lib/api'

/**
 * The phase-10 advertising shell (TASK-009). Nothing platform-specific
 * renders here yet — the catalog, connections, and campaign screens land in
 * TASK-010/011/012. What this page settles now is the entitlement gate
 * (`UpgradePrompt` without a platform entitlement, an empty state with one)
 * and the live contract call, which is what proves the generated-client
 * pipeline end to end.
 *
 * Entitlement keys mirror the access catalog the same way
 * `payments.stripe_connect` does in PaymentsSettings; per-platform gating
 * switches to the catalog-provided `entitlement_key` in TASK-010.
 */
let loading = $state(true)
let entitled = $state(true)
let notAvailable = $state(false)
let error = $state<string | undefined>(undefined)
let platforms = $state<PlatformView[]>([])

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never answer for the new one.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  notAvailable = false
  platforms = []

  if (!hasFeature('advertising.google_ads') && !hasFeature('advertising.meta_ads')) {
    entitled = false
    loading = false
    return
  }

  try {
    const result = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = result?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && err.status === 404) {
      notAvailable = true
      platforms = []
    } else if (
      err instanceof ApiError &&
      (err.status === 403 || err.type === 'access/missing-entitlement')
    ) {
      entitled = false
      platforms = []
    } else {
      error = t['admin.advertising.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function retry(): void {
  void load()
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.title']()}</h1>
      <p>{t['admin.advertising.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
      </Alert>
    {:else if loading}
      <Spinner label={t['admin.advertising.loading']()} />
    {:else if notAvailable}
      <EmptyState
        title={t['admin.advertising.empty']()}
        description={t['admin.advertising.emptyDescription']()}
      />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      <EmptyState
        title={t['admin.advertising.empty']()}
        description={t['admin.advertising.emptyDescription']()}
      />
    {/if}
  </Stack>
</Container>
