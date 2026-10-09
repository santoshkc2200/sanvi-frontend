<script lang="ts">
import {
  getTenantUsage,
  isRateLimited,
  listTenantEntitlements,
  QUOTA_DIMENSIONS,
} from '@sanvi/api-client'
import type { components, QuotaDimension, TenantUsage } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Badge, Container, EmptyState, Spinner, Stack, UsageDimensionCard } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type Entitlement = components['schemas']['ResolvedEntitlementView']

// Catalog keys per metered dimension — the card copy (name, warning,
// limit-reached) reads specifically to its dimension, so the names live in
// the catalog rather than in a formatter.
const DIMENSION_NAME_KEYS = {
  api_requests: 'admin.usage.dimension.apiRequests',
  tracked_conversions: 'admin.usage.dimension.trackedConversions',
  storage_bytes: 'admin.usage.dimension.storageBytes',
  custom_domains: 'admin.usage.dimension.customDomains',
  seats: 'admin.usage.dimension.seats',
  notification_sends: 'admin.usage.dimension.notificationSends',
} as const

let usage = $state<TenantUsage | null>(null)
let entitlements = $state<Entitlement[]>([])
let loading = $state(true)
let usageError = $state<string | undefined>(undefined)
let entitlementsError = $state<string | undefined>(undefined)
let rateLimited = $state(false)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  usageError = undefined
  entitlementsError = undefined
  rateLimited = false
  // Independent settles: the usage endpoint is new (backend TASK-026), so a
  // usage failure must not take down the entitlements section with it, and
  // vice versa. Each section renders its own error state.
  const [usageResult, entitlementsResult] = await Promise.all([
    getTenantUsage(apiClient).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    listTenantEntitlements(apiClient).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ])
  if (seq !== loadSeq) return
  if (usageResult.ok) usage = usageResult.value
  else if (isRateLimited(usageResult.error)) rateLimited = true
  else usageError = t['admin.usage.genericError']()
  if (entitlementsResult.ok) entitlements = entitlementsResult.value
  else entitlementsError = t['admin.usage.genericError']()
  loading = false
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

// Dimensions in display order, skipping whatever the backend did not meter
// (flags off): a missing dimension is absent, never a zero or a spinner.
const dimensionCards = $derived(
  (() => {
    const snapshot = usage
    if (snapshot === null) return []
    return QUOTA_DIMENSIONS.flatMap((dimension: QuotaDimension) => {
      const entry = snapshot.dimensions[dimension]
      if (!entry) return []
      const name = t[DIMENSION_NAME_KEYS[dimension]]()
      const usedText = fmt.number(entry.used)
      const limitText = fmt.number(entry.limit)
      const percent = `${Math.round((entry.used / entry.limit) * 100)}%`
      const bytes = dimension === 'storage_bytes'
      return [
        {
          dimension,
          name,
          used: entry.used,
          limit: entry.limit,
          unit: bytes ? t['admin.usage.unit.bytes']() : '',
          warningText: t[bytes ? 'admin.usage.warningStateBytes' : 'admin.usage.warningState']({
            dimension: name,
            used: usedText,
            limit: limitText,
            percent,
          }),
          limitReachedText: t[
            bytes ? 'admin.usage.limitReachedStateBytes' : 'admin.usage.limitReachedState'
          ]({
            dimension: name,
            used: usedText,
            limit: limitText,
            date: fmt.date(snapshot.period_end),
          }),
        },
      ]
    })
  })(),
)

const booleanFeatures = $derived(
  entitlements.filter((entitlement) => entitlement.kind === 'boolean'),
)
const isEmpty = $derived(
  dimensionCards.length === 0 && booleanFeatures.length === 0 && !usageError && !entitlementsError,
)
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.usage.title']()}</h1>
      <p>{t['admin.usage.description']()}</p>
    </div>

    {#if loading}
      <Spinner label={t['admin.usage.loading']()} />
    {:else if isEmpty && !rateLimited}
      <EmptyState title={t['admin.usage.empty']()} />
    {:else}
      {#if rateLimited}
        <Alert variant="error">{t['errors.failure.rateLimited']()}</Alert>
      {/if}
      {#if usageError}
        <Alert variant="error">{usageError}</Alert>
      {/if}
      {#if dimensionCards.length > 0}
        <div>
          <h2>{t['admin.usage.liveTitle']()}</h2>
          <div class="sanvi-usage__quota-grid">
            {#each dimensionCards as card (card.dimension)}
              <UsageDimensionCard
                name={card.name}
                used={card.used}
                limit={card.limit}
                unit={card.unit}
                warningText={card.warningText}
                limitReachedText={card.limitReachedText}
                upgradeCtaLabel={t['admin.usage.upgradeCta']()}
                upgradeHref="/billing"
              />
            {/each}
          </div>
        </div>
      {/if}

      {#if entitlementsError}
        <Alert variant="error">{entitlementsError}</Alert>
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
