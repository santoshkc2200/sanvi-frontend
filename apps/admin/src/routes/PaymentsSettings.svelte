<script lang="ts">
import {
  ApiError,
  createPaymentConnectionSession,
  getPaymentConnection,
  listPaymentProviders,
} from '@sanvi/api-client'
import type { components, PaymentConnectionView } from '@sanvi/api-client'
import { currentLocale, fmt, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Container,
  EmptyState,
  PaymentProviderCard,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { onDestroy } from 'svelte'
import { apiClient } from '../lib/api'
import { getAppEnv } from '../lib/env'
import { EXPLAINER_BODY_KEY, EXPLAINER_TITLE_KEY } from '../lib/payments/explainerCopy'
import PaymentConnectionStatus from '../lib/payments/PaymentConnectionStatus.svelte'
import { pollPaymentConnection, type Poller } from '../lib/payments/poll'
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
let connection = $state<PaymentConnectionView | null>(null)
let onboardingConnectionId = $state<string | null>(null)
let onboardingKey = $state(0)
let bannerKey = $state(0)
let managementKey = $state(0)
let creating = $state(false)
let createError = $state<string | undefined>(undefined)
let isCheckingWithStripe = $state(false)

let poller: Poller<PaymentConnectionView> | undefined

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's data.
let loadSeq = 0

function stopPoller(): void {
  if (poller) {
    poller.stop()
    poller = undefined
  }
  isCheckingWithStripe = false
}

function startPollingConnection(connId: string): void {
  stopPoller()
  poller = pollPaymentConnection(
    (signal) => getPaymentConnection(apiClient, connId, signal),
    (res) => res.status === 'active' || res.status === 'rejected' || res.status === 'disconnected',
    {
      onUpdate: (updated) => {
        connection = updated
        if (
          updated.status === 'active' ||
          updated.status === 'rejected' ||
          updated.status === 'disconnected'
        ) {
          onboardingConnectionId = null
        }
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 404) {
          clearPersistedConnectionId(getActiveTenantId() ?? undefined)
          connection = null
          onboardingConnectionId = null
          stopPoller()
        }
      },
      onPollStateChange: (checking) => {
        isCheckingWithStripe = checking
      },
    },
  )
  poller.start()
}

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  clearLastCreatedPaymentConnection()
  connection = null
  onboardingConnectionId = null
  stopPoller()

  try {
    const result = await listPaymentProviders(apiClient)
    if (seq !== loadSeq) return
    providers = result?.providers ?? []

    if (hasFeature('payments.stripe_connect')) {
      const tenantId = getActiveTenantId()
      const stored = readPersistedConnectionId(tenantId ?? undefined)
      if (stored) {
        try {
          const conn = await getPaymentConnection(apiClient, stored)
          if (seq !== loadSeq) return
          connection = conn
          if (conn.status === 'pending' || conn.status === 'onboarding') {
            onboardingConnectionId = stored
            onboardingKey = 0
            startPollingConnection(stored)
          } else {
            onboardingConnectionId = null
          }
        } catch (connErr) {
          if (seq !== loadSeq) return
          if (connErr instanceof ApiError && connErr.status === 404) {
            clearPersistedConnectionId(tenantId ?? undefined)
            connection = null
            onboardingConnectionId = null
          }
        }
      }
    }
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
      providers = []
    } else {
      error = t['admin.payments.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
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
      connection = conn
      onboardingConnectionId = conn.id
      onboardingKey += 1
      if (conn.status === 'pending' || conn.status === 'onboarding') {
        startPollingConnection(conn.id)
      }
    } else {
      const tid = getActiveTenantId()
      const stored = readPersistedConnectionId(tid ?? undefined)
      if (stored) {
        onboardingConnectionId = stored
        onboardingKey += 1
        try {
          connection = await getPaymentConnection(apiClient, stored)
        } catch {
          // ignore
        }
        startPollingConnection(stored)
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
        connection = null
        onboardingConnectionId = null
        stopPoller()
        createError = t['admin.payments.createConnectionError']()
      } else if (err.status === 409) {
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
  const connId = connection?.id ?? onboardingConnectionId
  if (!connId) throw new Error('No onboarding connection')
  const key = crypto.randomUUID()
  try {
    const session = await createPaymentConnectionSession(apiClient, connId, key)
    return session.client_secret
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      clearPersistedConnectionId(getActiveTenantId() ?? undefined)
      connection = null
      onboardingConnectionId = null
      stopPoller()
    }
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

function handleBannerRetry(): void {
  bannerKey += 1
}

function handleManagementRetry(): void {
  managementKey += 1
}

onDestroy(() => {
  stopPoller()
})

let publishableKey = $derived(getAppEnv().stripePublishableKey)
let locale = $derived(currentLocale())
let isStripeEnabled = $derived(hasFeature('payments.stripe_connect'))

$effect(() => {
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
    {:else if providers.length === 0 && !error && !onboardingConnectionId && !connection}
      <EmptyState title={t['admin.payments.empty']()} description={t['admin.payments.emptyDescription']()} />
    {:else if !error}
      {#if connection && isStripeEnabled && publishableKey}
        <div class="sanvi-payments__notification-banner-slot">
          {#key bannerKey}
            {#await import('@sanvi/payments-connect/NotificationBanner.svelte') then mod}
              {@const NotificationBanner = mod.default}
              <NotificationBanner
                publishableKey={publishableKey}
                fetchClientSecret={fetchClientSecret}
                locale={locale}
                onRetry={handleBannerRetry}
                labels={{
                  loading: t['admin.payments.notificationBannerLoading'](),
                  loadErrorTitle: t['admin.payments.notificationBannerLoadErrorTitle'](),
                  loadErrorBody: t['admin.payments.notificationBannerLoadErrorBody'](),
                  sessionErrorTitle: t['admin.payments.notificationBannerSessionErrorTitle'](),
                  sessionErrorBody: t['admin.payments.notificationBannerSessionErrorBody'](),
                  retry: t['admin.payments.notificationBannerRetry'](),
                  support: t['admin.payments.onboardingSupport'](),
                  technicalDetail: t['admin.payments.onboardingTechnicalDetail'](),
                }}
              />
            {:catch}
              <!-- Silent fallback if notification banner module fails to load -->
            {/await}
          {/key}
        </div>

        <PaymentConnectionStatus
          connection={connection}
          isChecking={isCheckingWithStripe}
          labels={{
            statusSectionTitle: t['admin.payments.statusSectionTitle'](),
            statusCheckingWithStripe: t['admin.payments.statusCheckingWithStripe'](),
            statusActive: t['admin.payments.statusActive'](),
            statusOnboarding: t['admin.payments.statusOnboarding'](),
            statusPending: t['admin.payments.statusPending'](),
            statusRestricted: t['admin.payments.statusRestricted'](),
            statusRejected: t['admin.payments.statusRejected'](),
            statusDisconnected: t['admin.payments.statusDisconnected'](),
            verdictCanAcceptPayments: t['admin.payments.verdictCanAcceptPayments'](),
            verdictCannotAcceptPayments: t['admin.payments.verdictCannotAcceptPayments'](),
            verdictRestrictedTitle: t['admin.payments.verdictRestrictedTitle'](),
            verdictRestrictedBody: t['admin.payments.verdictRestrictedBody'](),
            capabilitiesTitle: t['admin.payments.capabilitiesTitle'](),
            capabilityCardPayments: t['admin.payments.capabilityCardPayments'](),
            capabilityTransfers: t['admin.payments.capabilityTransfers'](),
            capabilityActive: t['admin.payments.capabilityActive'](),
            capabilityInactive: t['admin.payments.capabilityInactive'](),
            capabilityPending: t['admin.payments.capabilityPending'](),
            requirementsTitle: t['admin.payments.requirementsTitle'](),
            requirementsEmpty: t['admin.payments.requirementsEmpty'](),
            requirementsPastDueTitle: t['admin.payments.requirementsPastDueTitle'](),
            requirementsCurrentlyDueTitle: t['admin.payments.requirementsCurrentlyDueTitle'](),
            requirementsEventuallyDueTitle: t['admin.payments.requirementsEventuallyDueTitle'](),
            requirementsDeadline: connection.requirements.deadline
              ? t['admin.payments.requirementsDeadline']({
                  deadline: fmt.date(connection.requirements.deadline, 'medium'),
                })
              : '',
            stripeHelpLink: t['admin.payments.stripeHelpLink'](),
            openStripeDashboard: t['admin.payments.openStripeDashboard'](),
          }}
        />
      {/if}

      {#if connection && isStripeEnabled && (connection.status === 'active' || connection.status === 'restricted') && publishableKey}
        <section
          class="sanvi-payments__management"
          aria-labelledby="sanvi-payments-management-heading"
        >
          <div class="sanvi-payments__management-header">
            <h2 id="sanvi-payments-management-heading" class="sanvi-payments__management-title">
              {t['admin.payments.accountManagementTitle']()}
            </h2>
            <p class="sanvi-payments__management-description">
              {t['admin.payments.accountManagementDescription']()}
            </p>
          </div>

          {#key managementKey}
            {#await import('@sanvi/payments-connect/AccountManagement.svelte') then mod}
              {@const AccountManagement = mod.default}
              <AccountManagement
                publishableKey={publishableKey}
                fetchClientSecret={fetchClientSecret}
                locale={locale}
                onRetry={handleManagementRetry}
                labels={{
                  loading: t['admin.payments.accountManagementLoading'](),
                  loadErrorTitle: t['admin.payments.accountManagementLoadErrorTitle'](),
                  loadErrorBody: t['admin.payments.accountManagementLoadErrorBody'](),
                  sessionErrorTitle: t['admin.payments.accountManagementSessionErrorTitle'](),
                  sessionErrorBody: t['admin.payments.accountManagementSessionErrorBody'](),
                  retry: t['admin.payments.accountManagementRetry'](),
                  support: t['admin.payments.onboardingSupport'](),
                  technicalDetail: t['admin.payments.onboardingTechnicalDetail'](),
                }}
              />
            {:catch}
              <div role="alert" class="sanvi-payments__onboarding-error">
                <p>{t['admin.payments.accountManagementLoadErrorBody']()}</p>
                <button
                  type="button"
                  class="sanvi-payments__retry-button"
                  onclick={handleManagementRetry}
                >
                  {t['admin.payments.onboardingRetry']()}
                </button>
                <span class="sanvi-payments__support-text"
                  >{t['admin.payments.onboardingSupport']()}</span
                >
              </div>
            {/await}
          {/key}
        </section>
      {/if}

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
              <h2 id="sanvi-payments-onboarding-heading" class="sanvi-payments__onboarding-title">
                {t['admin.payments.onboardingTitle']()}
              </h2>
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
                {:catch}
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
            {@const isConnectActive =
              onboardingConnectionId !== null ||
              (connection !== null &&
                (connection.status === 'pending' ||
                  connection.status === 'onboarding' ||
                  connection.status === 'active' ||
                  connection.status === 'restricted'))}
            <PaymentProviderCard
              provider={provider}
              entitled={hasFeature('payments.stripe_connect')}
              connectDisabled={!CONNECT_IMPLEMENTED || creating || isConnectActive}
              connectDisabledReason={creating
                ? t['admin.payments.onboardingLoading']()
                : isConnectActive
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
                {#if connection && connection.provider === provider.kind}
                  <Badge
                    variant={connection.status === 'active'
                      ? 'success'
                      : connection.status === 'restricted' || connection.status === 'rejected'
                        ? 'error'
                        : connection.status === 'disconnected'
                          ? 'neutral'
                          : 'warning'}
                  >
                    {#snippet children()}
                      {#if connection?.status === 'active'}
                        <span>✓ {t['admin.payments.statusActive']()}</span>
                      {:else if connection?.status === 'restricted'}
                        <span>⚠ {t['admin.payments.statusRestricted']()}</span>
                      {:else if connection?.status === 'rejected'}
                        <span>⚠ {t['admin.payments.statusRejected']()}</span>
                      {:else if connection?.status === 'disconnected'}
                        <span>○ {t['admin.payments.statusDisconnected']()}</span>
                      {:else if connection?.status === 'onboarding'}
                        <span>⏳ {t['admin.payments.statusOnboarding']()}</span>
                      {:else}
                        <span>⏳ {t['admin.payments.statusPending']()}</span>
                      {/if}
                    {/snippet}
                  </Badge>
                {/if}
              {/snippet}
            </PaymentProviderCard>
          {/each}
        </div>
      </section>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-payments__notification-banner-slot {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

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

  .sanvi-payments__onboarding,
  .sanvi-payments__management {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__onboarding-title,
  .sanvi-payments__management-title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__onboarding-description,
  .sanvi-payments__management-description {
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
