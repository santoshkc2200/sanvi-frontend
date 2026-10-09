<script lang="ts">
import { getSystemReadiness, type ReadinessStates } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { Container, Stack } from '@sanvi/ui'
import { getMarketingRawApiClient } from '$lib/api'
import { toOverallStatus } from '$lib/status'
import type { PageData } from './$types'

interface Props {
  data: PageData
}

let { data }: Props = $props()

// The last known signal: the prerendered build-time read until the first
// successful client poll replaces it. A failed poll never clears it — the
// page tells the truth from the last known state rather than crashing to an
// error. All three read `data` through `$derived` (never a `$state`
// initializer), so a client-side invalidation that re-runs the server load
// flows straight through.
let fresh = $state<ReadinessStates | null>(null)
let pollFailed = $state(false)
let pollTime = $state<string | null>(null)
let refreshing = $state(false)

const readiness = $derived(fresh ?? data.readiness)
const unreachable = $derived(pollFailed || (fresh === null && data.loadError))
const lastUpdated = $derived(pollTime ?? data.builtAt)

const overall = $derived(
  toOverallStatus(
    unreachable ? null : readiness,
    unreachable ? new Error('unreachable') : undefined,
  ),
)
const stateLabel = $derived(
  overall === 'operational'
    ? t['marketing.status.state.operational']()
    : overall === 'degraded'
      ? t['marketing.status.state.degraded']()
      : t['marketing.status.state.unknown'](),
)
const degradedChecks = $derived(
  (readiness?.checks ?? [])
    .filter((check) => check.state === 'degraded')
    .map((check) => check.name),
)

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    fresh = await getSystemReadiness(getMarketingRawApiClient())
    pollFailed = false
    pollTime = new Date().toISOString()
  } catch {
    pollFailed = true
  } finally {
    refreshing = false
  }
}

$effect(() => {
  void refresh()
  const timer = setInterval(() => void refresh(), 30_000)
  return () => clearInterval(timer)
})
</script>

<svelte:head>
  <title>{t['marketing.status.pageTitle']()}</title>
  <meta name="description" content={t['marketing.status.metaDescription']()} />
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <Stack gap="2" align="center">
      <h1 class="sanvi-status__title">{t['marketing.status.heading']()}</h1>
      <p class="sanvi-status__lead">{t['marketing.status.lead']()}</p>
    </Stack>

    <section
      class="sanvi-status__state sanvi-status__state--{overall}"
      aria-label={stateLabel}
      data-status={overall}
    >
      <p class="sanvi-status__state-label">{stateLabel}</p>
      {#if overall === 'operational'}
        <h2>{t['marketing.status.operational.title']()}</h2>
        <p>{t['marketing.status.operational.description']()}</p>
      {:else if overall === 'degraded'}
        <h2>{t['marketing.status.degraded.title']()}</h2>
        <p>{t['marketing.status.degraded.description']({ checks: degradedChecks.join(', ') })}</p>
      {:else}
        <h2>{t['marketing.status.unknown.title']()}</h2>
        <p>{t['marketing.status.unknown.description']()}</p>
      {/if}
      <p class="sanvi-status__updated">{t['marketing.status.lastUpdated']({ date: lastUpdated })}</p>
      <button type="button" class="sanvi-status__refresh" onclick={() => void refresh()}>
        {t['marketing.status.refresh']()}
      </button>
    </section>

    <section aria-label={t['marketing.status.checks.heading']()}>
      <h2>{t['marketing.status.checks.heading']()}</h2>
      {#if readiness}
        <ul class="sanvi-status__checks">
          {#each readiness.checks as check (check.name)}
            <li class="sanvi-status__check">
              <span>{check.name}</span>
              <span data-check-state={check.state}>
                {check.state === 'ok'
                  ? t['marketing.status.check.ok']()
                  : t['marketing.status.check.degraded']()}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p>{t['marketing.status.unknown.description']()}</p>
      {/if}
    </section>

    <section aria-label={t['marketing.status.incidents.heading']()}>
      <h2>{t['marketing.status.incidents.heading']()}</h2>
      {#if data.incidents.length === 0}
        <p data-incidents="empty">{t['marketing.status.incidents.empty']()}</p>
      {:else}
        <ul class="sanvi-status__incidents">
          {#each data.incidents as incident (incident.id)}
            <li data-incident={incident.id}>
              <h3>{t[`marketing.status.incident.${incident.journey}.title`]()}</h3>
              <p>{t[`marketing.status.incident.${incident.journey}.body`]()}</p>
              <p>{incident.date}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <p class="sanvi-status__limitation" data-hosting-limitation>
      {t['marketing.status.hostingLimitation']()}
    </p>
  </Stack>
</Container>

<style>
  .sanvi-status__title {
    margin: 0;
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    text-align: center;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-status__lead {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-status__state {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-status__state--degraded {
    border-color: var(--sanvi-color-status-danger);
  }

  .sanvi-status__state-label {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-bold);
    text-transform: uppercase;
  }

  .sanvi-status__updated {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-status__refresh {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: transparent;
    color: var(--sanvi-color-text-primary);
    cursor: pointer;
  }

  .sanvi-status__checks {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-status__check {
    display: flex;
    justify-content: space-between;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-status__incidents {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-status__limitation {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
