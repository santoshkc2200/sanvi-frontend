<script lang="ts">
import { listTenantEntitlements } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Badge, Container, EmptyState, Spinner, Stack, StatCard } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type Entitlement = components['schemas']['ResolvedEntitlementView']

// The resolved-entitlement endpoint reports the *limit*, not live
// consumption — there's no "used so far" counter exposed yet, so this
// renders limits as stats rather than a meter implying a fill level
// (see the note under the quota grid below).

let entitlements = $state<Entitlement[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const result = await listTenantEntitlements(apiClient)
    if (seq !== loadSeq) return
    entitlements = result
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.usage.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

const quotaFeatures = $derived(entitlements.filter((entitlement) => entitlement.kind === 'quota'))
const booleanFeatures = $derived(
  entitlements.filter((entitlement) => entitlement.kind === 'boolean'),
)
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.usage.title']()}</h1>
      <p>{t['admin.usage.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.usage.loading']()} />
    {:else if entitlements.length === 0}
      <EmptyState title={t['admin.usage.empty']()} />
    {:else}
      {#if quotaFeatures.length > 0}
        <div>
          <h2>{t['admin.usage.quotaTitle']()}</h2>
          <p class="sanvi-usage__note">{t['admin.usage.noUsageDataNote']()}</p>
          <div class="sanvi-usage__quota-grid">
            {#each quotaFeatures as entitlement (entitlement.feature)}
              <StatCard
                label={entitlement.feature}
                value={entitlement.limit === null || entitlement.limit === undefined ? '—' : String(entitlement.limit)}
                description={entitlement.expires_at ? t['admin.usage.expires']({ date: fmt.date(entitlement.expires_at) }) : undefined}
              />
            {/each}
          </div>
        </div>
      {/if}

      {#if booleanFeatures.length > 0}
        <div>
          <h2>{t['admin.usage.featuresTitle']()}</h2>
          <Stack gap="2" align="start">
            {#each booleanFeatures as entitlement (entitlement.feature)}
              <div class="sanvi-usage__feature-row">
                <Badge variant={entitlement.enabled ? 'success' : 'neutral'}>{entitlement.feature}</Badge>
                <span class="sanvi-usage__source">{entitlement.source}</span>
                {#if entitlement.expires_at}
                  <span class="sanvi-usage__source">{t['admin.usage.expires']({ date: fmt.date(entitlement.expires_at) })}</span>
                {/if}
              </div>
            {/each}
          </Stack>
        </div>
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-usage__note {
    margin: 0 0 var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-usage__quota-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-48), 1fr));
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-usage__feature-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-usage__source {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
