<script lang="ts">
import { ApiError, createPaymentConnectionSession, listPaymentProviders } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { currentLocale, t } from '@sanvi/i18n'
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
import { getAppEnv } from '../lib/env'
import { EXPLAINER_BODY_KEY, EXPLAINER_TITLE_KEY } from '../lib/payments/explainerCopy'
import {
  clearLastCreatedPaymentConnection,
  clearPersistedConnectionId,
  getLastCreatedPaymentConnection,
  getProviderAdapter,
  readPersistedConnectionId,
} from '../lib/payments/providerRegistry'

type ProviderView = components['schemas']['ProviderView']

const CONNECT_IMPLEMENTED = true

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let providers = $state<ProviderView[]>([])
let onboardingConnectionId = $state<string | null>(null)
let onboardingKey = $state(0)
let creating = $state(false)
let createError = $state<string | undefined>(undefined)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  clearLastCreatedPaymentConnection()
  onboardingConnectionId = null
  restoreOnboardingIfPersisted()
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

function restoreOnboardingIfPersisted(): void {
  if (!hasFeature('payments.stripe_connect')) {
    onboardingConnectionId = null
    return
  }
  const tenantId = getActiveTenantId()
  const stored = readPersistedConnectionId(tenantId ?? undefined)
  if (stored) {
    onboardingConnectionId = stored
    onboardingKey = 0
  } else {
    onboardingConnectionId = null
  }
}

async function handleConnect(provider: ProviderView): Promise<void> {
  if (!hasFeature('payments.stripe_connect')) return
  const adapter = getProviderAdapter(provider.kind)
  creating = true
  createError = undefined
  error = undefined
  try {
    await adapter.connect(provider)
    const conn = getLastCreatedPaymentConnection()
    if (conn) {
      onboardingConnectionId = conn.id
      onboardingKey += 1
    } else {
      const tid = getActiveTenantId()
      const stored = readPersistedConnectionId(tid ?? undefined)
      if (stored) {
        onboardingConnectionId = stored
        onboardingKey += 1
      } else {
        createError = t['admin.payments.createConnectionError']()
      }
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        createError = t['admin.payments.createConnectionForbidden']()
      } else if (err.status === 404) {
        clearPersistedConnectionId(getActiveTenantId() ?? undefined)
        onboardingConnectionId = null
        createError = t['admin.payments.createConnectionError']()
      } else if (err.status === 409) {
        // TODO(TASK-004): The backend has no GET /api/v1/tenant/payments/connections endpoint
        // and the 409 ProblemDetail carries no connection id, so a tenant without a persisted
        // connection id cannot recover or resume here until the backend provides a list endpoint
        // or returns the existing connection id in the 409 response.
        createError = t['admin.payments.createConnectionExists']()
      } else if (err.status === 502) {
        createError = t['admin.payments.createConnectionUnavailable']()
      } else {
        createError = t['admin.payments.createConnectionError']()
      }
    } else {
      createError = t['admin.payments.createConnectionError']()
    }
  } finally {
    creating = false
  }
}

async function fetchClientSecret(): Promise<string> {
  if (!onboardingConnectionId) throw new Error('No onboarding connection')
  const key = crypto.randomUUID()
  try {
    const session = await createPaymentConnectionSession(apiClient, onboardingConnectionId, key)
    return session.client_secret
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      clearPersistedConnectionId(getActiveTenantId() ?? undefined)
      onboardingConnectionId = null
    }
    // AccountOnboarding heuristics look for "session" in the message to
    // differentiate from Connect.js script load errors.
    throw new Error(
      `Failed to create connection session: ${err instanceof Error ? err.message : 'Unknown'}`,
    )
  }
}

function handleOnboardingExit(): void {
  // Stripe manages progress; staying on page keeps the flow resumable.
}

function handleOnboardingRetry(): void {
  onboardingKey += 1
}

function handleSessionRetry(): void {
  onboardingKey += 1
}

let publishableKey = $derived(getAppEnv().stripePublishableKey)
let locale = $derived(currentLocale())
let isStripeEnabled = $derived(hasFeature('payments.stripe_connect'))

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

    {#if createError}
      <Alert variant="error">{createError}</Alert>
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
    {:else if providers.length === 0 && !error && !onboardingConnectionId}
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

        <div class="sanvi-payments__preconnect">
          <div class="sanvi-payments__preconnect-item">
            <h4 class="sanvi-payments__preconnect-title">
              {t['admin.payments.preConnectWhatToExpectTitle']()}
            </h4>
            <p class="sanvi-payments__preconnect-body">
              {t['admin.payments.preConnectWhatToExpectBody']()}
            </p>
          </div>
          <div class="sanvi-payments__preconnect-item">
            <h4 class="sanvi-payments__preconnect-title">
              {t['admin.payments.preConnectTimeEstimateTitle']()}
            </h4>
            <p class="sanvi-payments__preconnect-body">
              {t['admin.payments.preConnectTimeEstimateBody']()}
            </p>
          </div>
        </div>

        {#if onboardingConnectionId && isStripeEnabled}
          <section
            class="sanvi-payments__onboarding"
            aria-labelledby="sanvi-payments-onboarding-heading"
          >
            <div class="sanvi-payments__onboarding-header">
              <h3 id="sanvi-payments-onboarding-heading" class="sanvi-payments__onboarding-title">
                {t['admin.payments.onboardingTitle']()}
              </h3>
              <p class="sanvi-payments__onboarding-description">
                {t['admin.payments.onboardingDescription']()}
              </p>
            </div>

            {#if !publishableKey}
              <Alert variant="error">{t['admin.payments.publishableKeyMissing']()}</Alert>
            {:else}
              {#key onboardingKey}
                {#await import('@sanvi/payments-connect/AccountOnboarding.svelte') then mod}
                  {@const AccountOnboarding = mod.default}
                  <AccountOnboarding
                    publishableKey={publishableKey}
                    fetchClientSecret={fetchClientSecret}
                    locale={locale}
                    onExit={handleOnboardingExit}
                    onRetry={handleOnboardingRetry}
                    labels={{
                      loading: t['admin.payments.onboardingLoading'](),
                      loadErrorTitle: t['admin.payments.onboardingLoadErrorTitle'](),
                      loadErrorBody: t['admin.payments.onboardingLoadErrorBody'](),
                      sessionErrorTitle: t['admin.payments.onboardingSessionErrorTitle'](),
                      sessionErrorBody: t['admin.payments.onboardingSessionErrorBody'](),
                      retry: t['admin.payments.onboardingRetry'](),
                      support: t['admin.payments.onboardingSupport'](),
                      technicalDetail: t['admin.payments.onboardingTechnicalDetail'](),
                    }}
                  />
                {:catch err}
                  <div role="alert" class="sanvi-payments__onboarding-error">
                    <p>{t['admin.payments.onboardingLoadErrorBody']()}</p>
                    <button
                      type="button"
                      class="sanvi-payments__retry-button"
                      onclick={handleSessionRetry}
                    >
                      {t['admin.payments.onboardingRetry']()}
                    </button>
                    <span class="sanvi-payments__support-text"
                      >{t['admin.payments.onboardingSupport']()}</span
                    >
                  </div>
                {/await}
              {/key}
            {/if}
          </section>
        {/if}

        <div class="sanvi-payments__grid">
          {#each providers as provider (provider.kind)}
            <PaymentProviderCard
              provider={provider}
              entitled={hasFeature('payments.stripe_connect')}
              connectDisabled={!CONNECT_IMPLEMENTED || creating || onboardingConnectionId !== null}
              connectDisabledReason={creating
                ? t['admin.payments.onboardingLoading']()
                : onboardingConnectionId !== null
                  ? t['admin.payments.connectAlreadyStarted']()
                  : t['admin.payments.connectDisabledReason']()}
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

  .sanvi-payments__preconnect {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
  }

  /* Breakpoint is a viewport width, not a design token — no token exists for this. */
  @media (max-width: 640px) { /* sanvi-tokens-ignore */
    .sanvi-payments__preconnect {
      grid-template-columns: 1fr;
    }
  }

  .sanvi-payments__preconnect-title {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__preconnect-body {
    margin: var(--sanvi-spacing-1) 0 0;
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

  .sanvi-payments__onboarding {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__onboarding-title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__onboarding-description {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__onboarding-error {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-error);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__retry-button {
    align-self: flex-start;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-primary-base);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-primary-base);
    color: var(--sanvi-color-text-inverse);
    font-size: var(--sanvi-font-size-sm);
    cursor: pointer;
  }

  .sanvi-payments__support-text {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
