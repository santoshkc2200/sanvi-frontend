<script lang="ts">
import { ApiError, listPaymentProviders } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Container,
  EmptyState,
  PaymentProviderCard,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { EXPLAINER_BODY_KEY, EXPLAINER_TITLE_KEY } from '../lib/payments/explainerCopy'
import { getProviderAdapter } from '../lib/payments/providerRegistry'

type ProviderView = components['schemas']['ProviderView']

// Connecting is wired up in TASK-003 (Connect.js loader + account session). Until
// then the CTA renders inert with a reason rather than as a button that silently
// does nothing. Flipping this to `true` is TASK-003's single switch.
const CONNECT_IMPLEMENTED = false

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let providers = $state<ProviderView[]>([])

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  try {
    const result = await listPaymentProviders(apiClient)
    if (seq !== loadSeq) return
    providers = result?.providers ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      // 403 names the entitlement; 404 means the `payments.enabled` phase
      // flag is off in that deployment. Both read to a tenant admin as
      // "not available yet", and neither is an error banner.
      entitled = false
      providers = []
    } else {
      error = t['admin.payments.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function handleConnect(provider: ProviderView): void {
  const adapter = getProviderAdapter(provider.kind)
  adapter.connect(provider).catch(() => {
    error = t['admin.payments.genericError']()
  })
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.payments.title']()}</h1>
      <p>{t['admin.payments.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.payments.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        feature="payments.stripe_connect"
        title={t['admin.payments.upgradeTitle']()}
        description={t['admin.payments.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else if providers.length === 0 && !error}
      <EmptyState title={t['admin.payments.empty']()} description={t['admin.payments.emptyDescription']()} />
    {:else if !error}
      <section class="sanvi-payments__providers" aria-labelledby="sanvi-payments-providers-heading">
        <div class="sanvi-payments__providers-header">
          <h2 id="sanvi-payments-providers-heading" class="sanvi-payments__providers-title">
            {t['admin.payments.providersTitle']()}
          </h2>
          <p class="sanvi-payments__providers-description">
            {t['admin.payments.providersDescription']()}
          </p>
        </div>

        <div class="sanvi-payments__explainer">
          <h3 class="sanvi-payments__explainer-title">{t[EXPLAINER_TITLE_KEY]()}</h3>
          <p class="sanvi-payments__explainer-body">{t[EXPLAINER_BODY_KEY]()}</p>
        </div>

        <div class="sanvi-payments__grid">
          {#each providers as provider (provider.kind)}
            <PaymentProviderCard
              provider={provider}
              entitled={hasFeature('payments.stripe_connect')}
              connectDisabled={!CONNECT_IMPLEMENTED}
              connectDisabledReason={t['admin.payments.connectDisabledReason']()}
              labels={{
                connectCta: t['admin.payments.connectCta'](),
                unavailableTitle: t['admin.payments.unavailableTitle'](),
                unavailableDescription: t['admin.payments.unavailableDescription'](),
                supportedCountriesLabel: t['admin.payments.supportedCountriesLabel'](),
                upgradeTitle: t['admin.payments.upgradeTitle'](),
                upgradeDescription: t['admin.payments.upgradeDescription'](),
              }}
              upgradeHref="/billing"
              onConnect={handleConnect}
            >
              {#snippet status()}
                <!-- TASK-004 fills the status/requirements slot here -->
              {/snippet}
            </PaymentProviderCard>
          {/each}
        </div>
      </section>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-payments__providers {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-6);
  }

  .sanvi-payments__providers-title {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__providers-description {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__explainer {
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-payments__explainer-title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__explainer-body {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(calc(var(--sanvi-spacing-48) + var(--sanvi-spacing-32)), 1fr)
    );
    gap: var(--sanvi-spacing-6);
  }
</style>
