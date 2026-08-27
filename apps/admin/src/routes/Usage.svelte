<script lang="ts">
import { listTenantEntitlements } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { Alert, Badge, Container, EmptyState, Spinner, Stack, StatCard } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type Entitlement = components['schemas']['ResolvedEntitlementView']

const COPY = {
  title: 'Usage',
  description: 'Your plan and manually granted entitlements.',
  quotaTitle: 'Limits',
  featuresTitle: 'Features',
  expires: (date: string) => `Expires ${date}`,
  loading: 'Loading',
  genericError: 'Could not load usage. Try again in a moment.',
  empty: 'No entitlements yet.',
  // The resolved-entitlement endpoint reports the *limit*, not live
  // consumption — there's no "used so far" counter exposed yet, so this
  // renders limits as stats rather than a meter implying a fill level.
  noUsageDataNote: 'Live usage against these limits is not tracked yet.',
}

let entitlements = $state<Entitlement[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    entitlements = await listTenantEntitlements(apiClient)
  } catch {
    error = COPY.genericError
  } finally {
    loading = false
  }
}

$effect(() => {
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
      <h1>{COPY.title}</h1>
      <p>{COPY.description}</p>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={COPY.loading} />
    {:else if entitlements.length === 0}
      <EmptyState title={COPY.empty} />
    {:else}
      {#if quotaFeatures.length > 0}
        <div>
          <h2>{COPY.quotaTitle}</h2>
          <p class="sanvi-usage__note">{COPY.noUsageDataNote}</p>
          <div class="sanvi-usage__quota-grid">
            {#each quotaFeatures as entitlement (entitlement.feature)}
              <StatCard
                label={entitlement.feature}
                value={entitlement.limit === null || entitlement.limit === undefined ? '—' : String(entitlement.limit)}
                description={entitlement.expires_at ? COPY.expires(entitlement.expires_at) : undefined}
              />
            {/each}
          </div>
        </div>
      {/if}

      {#if booleanFeatures.length > 0}
        <div>
          <h2>{COPY.featuresTitle}</h2>
          <Stack gap="2" align="start">
            {#each booleanFeatures as entitlement (entitlement.feature)}
              <div class="sanvi-usage__feature-row">
                <Badge variant={entitlement.enabled ? 'success' : 'neutral'}>{entitlement.feature}</Badge>
                <span class="sanvi-usage__source">{entitlement.source}</span>
                {#if entitlement.expires_at}
                  <span class="sanvi-usage__source">{COPY.expires(entitlement.expires_at)}</span>
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
