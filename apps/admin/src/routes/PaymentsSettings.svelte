<script lang="ts">
import {
  ApiError,
  createPaymentConnectionSession,
  disconnectPaymentConnection,
  getPaymentConnection,
  getTenantTaxSettings,
  listPaymentProviders,
  listTenantPayouts,
  updateTenantTaxSettings,
} from '@sanvi/api-client'
import type {
  components,
  PaymentConnectionView,
  PayoutView,
  TaxSettingsView,
} from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { formatMinor } from '@sanvi/billing-elements'
import { currentLocale, fmt, hasMessage, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  Dialog,
  EmptyState,
  Field,
  Input,
  PaymentProviderCard,
  showToast,
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

interface DisconnectBlocker {
  code: string
  summary_key: string
}

function isBlockerArray(value: unknown): value is DisconnectBlocker[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (b) =>
        typeof b === 'object' &&
        b !== null &&
        typeof (b as { code?: unknown }).code === 'string' &&
        typeof (b as { summary_key?: unknown }).summary_key === 'string',
    )
  )
}

function renderDisconnectBlocker(blocker: DisconnectBlocker): string {
  const key = blocker.summary_key as MessageKey
  const tMap = t as unknown as Record<string, () => string>
  if (key && typeof tMap[key] === 'function') {
    return tMap[key]()
  }
  if (blocker.code === 'in_flight_payments') {
    return t['payments.disconnect.blocker.inFlightPayments']
      ? t['payments.disconnect.blocker.inFlightPayments']()
      : blocker.code
  }
  if (blocker.code === 'open_disputes') {
    return t['payments.disconnect.blocker.openDisputes']
      ? t['payments.disconnect.blocker.openDisputes']()
      : blocker.code
  }
  if (blocker.code === 'pending_payouts') {
    return t['payments.disconnect.blocker.pendingPayouts']
      ? t['payments.disconnect.blocker.pendingPayouts']()
      : blocker.code
  }
  return blocker.code
}

const CONNECT_IMPLEMENTED = true

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let degradedMode = $state(false)
let providers = $state<ProviderView[]>([])
let connection = $state<PaymentConnectionView | null>(null)
let onboardingConnectionId = $state<string | null>(null)
let onboardingKey = $state(0)
let bannerKey = $state(0)
let managementKey = $state(0)
let creating = $state(false)
let createError = $state<string | undefined>(undefined)
let isCheckingWithStripe = $state(false)

let payouts = $state<PayoutView[]>([])
let taxSettings = $state<TaxSettingsView | null>(null)
let taxCheckboxChecked = $state(false)
let taxDisableDialogOpen = $state(false)
let updatingTax = $state(false)
let taxUpdateError = $state<string | undefined>(undefined)

let disconnectDialogOpen = $state(false)
let typedDisconnectPhrase = $state('')
let disconnectIdempotencyKey = $state('')
let disconnecting = $state(false)
let disconnectError = $state<string | undefined>(undefined)
let disconnectBlockers = $state<DisconnectBlocker[]>([])

$effect(() => {
  if (!taxDisableDialogOpen) {
    taxCheckboxChecked = taxSettings?.enabled ?? false
  }
})

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
        if (err instanceof ApiError) {
          if (err.type === 'payments/provider-unavailable') {
            degradedMode = true
          } else if (err.status === 404) {
            clearPersistedConnectionId(getActiveTenantId() ?? undefined)
            connection = null
            onboardingConnectionId = null
            stopPoller()
          }
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
  degradedMode = false
  entitled = true
  clearLastCreatedPaymentConnection()
  connection = null
  onboardingConnectionId = null
  payouts = []
  taxSettings = null
  taxUpdateError = undefined
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
          if (connErr instanceof ApiError) {
            if (connErr.type === 'payments/provider-unavailable') {
              degradedMode = true
            } else if (connErr.status === 404) {
              clearPersistedConnectionId(tenantId ?? undefined)
              connection = null
              onboardingConnectionId = null
            }
          }
        }
      }

      try {
        const [payoutsRes, taxRes] = await Promise.allSettled([
          listTenantPayouts(apiClient),
          getTenantTaxSettings(apiClient),
        ])
        if (seq !== loadSeq) return
        if (payoutsRes.status === 'fulfilled') {
          payouts = payoutsRes.value?.payouts ?? []
        } else if (
          payoutsRes.reason instanceof ApiError &&
          payoutsRes.reason.type === 'payments/provider-unavailable'
        ) {
          degradedMode = true
        }

        if (taxRes.status === 'fulfilled') {
          taxSettings = taxRes.value ?? null
        } else if (
          taxRes.reason instanceof ApiError &&
          taxRes.reason.type === 'payments/provider-unavailable'
        ) {
          degradedMode = true
        }
      } catch {
        // Non-fatal if payouts/tax cannot be loaded
      }
    }
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && err.type === 'payments/provider-unavailable') {
      degradedMode = true
    } else if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
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

const hasFailedPayout = $derived(payouts.some((p) => p.status === 'failed'))
const platformFee = $derived(taxSettings?.platform_fee)
const feeCurrency = $derived(
  platformFee?.fixed_currency || connection?.default_currency || undefined,
)
const hasManagePermission = $derived(can('payments.manage', getActiveTenantId()))

const preflightFails = $derived(
  Boolean(
    taxSettings?.warning ||
      taxSettings?.provider_status !== 'active' ||
      (taxSettings && taxSettings.active_registrations <= 0),
  ),
)

const toggleDisabled = $derived(!hasManagePermission || (!taxSettings?.enabled && preflightFails))

const toggleDisabledReason = $derived.by(() => {
  if (!hasManagePermission) {
    return t['admin.payments.taxDisabledPermission']()
  }
  if (!taxSettings?.enabled) {
    if (taxSettings?.warning) {
      const warningCode = taxSettings.warning.code
      return hasMessage(warningCode) ? t[warningCode]() : t['payments.tax.warning.generic']()
    }
    if (taxSettings && taxSettings.provider_status !== 'active') {
      return t['admin.payments.taxDisabledProviderInactive']()
    }
    if (taxSettings && taxSettings.active_registrations <= 0) {
      return t['admin.payments.taxDisabledNoRegistrations']()
    }
  }
  return undefined
})

function getPayoutStatusVariant(
  status: string,
): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'paid':
      return 'success'
    case 'failed':
      return 'error'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

function getPayoutStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return t['admin.payments.payoutsStatusPaid']()
    case 'pending':
      return t['admin.payments.payoutsStatusPending']()
    case 'failed':
      return t['admin.payments.payoutsStatusFailed']()
    default:
      return status
  }
}

function getTaxWarningMessage(code: string): string {
  if (hasMessage(code)) {
    return t[code]()
  }
  return t['payments.tax.warning.generic']()
}

async function handleTaxToggleChange(event: Event & { currentTarget: HTMLInputElement }) {
  if (toggleDisabled || updatingTax || !taxSettings) return
  const willEnable = event.currentTarget.checked

  if (willEnable) {
    updatingTax = true
    taxUpdateError = undefined
    try {
      const updated = await updateTenantTaxSettings(apiClient, { enabled: true })
      taxSettings = updated
      showToast({
        title: t['admin.payments.taxSuccessEnabled'](),
        variant: 'success',
      })
    } catch (err) {
      taxCheckboxChecked = false
      if (err instanceof ApiError && err.status === 409) {
        taxUpdateError = err.message || t['admin.payments.taxDisabledPreflight']()
      } else {
        taxUpdateError = t['admin.payments.taxUpdateError']()
      }
    } finally {
      updatingTax = false
    }
  } else {
    taxCheckboxChecked = true
    taxUpdateError = undefined
    taxDisableDialogOpen = true
  }
}

function cancelDisableTax(): void {
  taxDisableDialogOpen = false
  taxUpdateError = undefined
  taxCheckboxChecked = taxSettings?.enabled ?? false
}

async function confirmDisableTax(): Promise<void> {
  if (updatingTax || !taxSettings) return
  updatingTax = true
  taxUpdateError = undefined
  try {
    const updated = await updateTenantTaxSettings(apiClient, { enabled: false })
    taxSettings = updated
    taxDisableDialogOpen = false
    showToast({
      title: t['admin.payments.taxSuccessDisabled'](),
      variant: 'success',
    })
  } catch {
    taxUpdateError = t['admin.payments.taxUpdateError']()
  } finally {
    updatingTax = false
  }
}

// Generate the idempotency key once per disconnect dialog open lifecycle.
$effect(() => {
  if (disconnectDialogOpen) {
    if (!disconnectIdempotencyKey) {
      disconnectIdempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0
              const v = c === 'x' ? r : (r & 0x3) | 0x8
              return v.toString(16)
            })
    }
    typedDisconnectPhrase = ''
    disconnectError = undefined
    disconnectBlockers = []
    disconnecting = false
  } else {
    disconnectIdempotencyKey = ''
    typedDisconnectPhrase = ''
    disconnectError = undefined
    disconnectBlockers = []
    disconnecting = false
  }
})

async function handleDisconnect(): Promise<void> {
  if (
    !connection ||
    !hasManagePermission ||
    disconnecting ||
    typedDisconnectPhrase.trim() !== 'DISCONNECT'
  ) {
    return
  }

  disconnecting = true
  disconnectError = undefined
  disconnectBlockers = []

  try {
    await disconnectPaymentConnection(apiClient, connection.id, disconnectIdempotencyKey)
    clearPersistedConnectionId(getActiveTenantId() ?? undefined)
    disconnectDialogOpen = false
    showToast({
      title: t['admin.payments.disconnectSuccessToast'](),
      variant: 'success',
    })
    await load()
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const blockers = err.problem?.['blockers']
      if (isBlockerArray(blockers)) {
        disconnectBlockers = blockers
      } else {
        disconnectError = err.message || t['admin.payments.disconnectError']()
      }
    } else if (err instanceof ApiError && err.type === 'payments/provider-unavailable') {
      degradedMode = true
      disconnectError = t['admin.payments.disconnectError']()
    } else if (err instanceof Error) {
      disconnectError = err.message
    } else {
      disconnectError = t['admin.payments.disconnectError']()
    }
  } finally {
    disconnecting = false
  }
}

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

    {#if degradedMode}
      <Alert variant="warning">
        <strong>{t['admin.payments.degradedNoticeTitle']()}</strong>
        <p>{t['admin.payments.degradedNoticeBody']()}</p>
      </Alert>
    {/if}

    {#if hasFailedPayout}
      <Alert variant="error">
        <strong>{t['admin.payments.failedPayoutNoticeTitle']()}</strong>
        <p>{t['admin.payments.failedPayoutNoticeBody']()}</p>
      </Alert>
    {/if}

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

      {#if isStripeEnabled && (connection || payouts.length > 0)}
        <section class="sanvi-payments__payouts" aria-labelledby="sanvi-payments-payouts-heading">
          <div class="sanvi-payments__payouts-header">
            <h2 id="sanvi-payments-payouts-heading" class="sanvi-payments__payouts-title">
              {t['admin.payments.payoutsTitle']()}
            </h2>
            <p class="sanvi-payments__payouts-description">
              {t['admin.payments.payoutsDescription']()}
            </p>
          </div>

          {#if payouts.length === 0}
            <EmptyState
              title={t['admin.payments.payoutsEmpty']()}
              description={t['admin.payments.payoutsEmptyDescription']()}
            />
          {:else}
            <div class="sanvi-payments__table-wrapper">
              <table class="sanvi-payments__table">
                <thead>
                  <tr>
                    <th scope="col">{t['admin.payments.payoutsColDate']()}</th>
                    <th scope="col">{t['admin.payments.payoutsColAmount']()}</th>
                    <th scope="col">{t['admin.payments.payoutsColStatus']()}</th>
                    <th scope="col">{t['admin.payments.payoutsColPayoutId']()}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each payouts as payout (payout.external_payout_id)}
                    <tr>
                      <td>
                        <span class="sanvi-payments__date">
                          {payout.arrival_at ? fmt.datetime(payout.arrival_at, 'medium') : '—'}
                        </span>
                      </td>
                      <td>
                        <strong class="sanvi-payments__amount">
                          {formatMinor(payout.amount_minor, payout.currency)}
                        </strong>
                      </td>
                      <td>
                        <Badge variant={getPayoutStatusVariant(payout.status)}>
                          {#snippet children()}
                            {getPayoutStatusLabel(payout.status)}
                          {/snippet}
                        </Badge>
                      </td>
                      <td>
                        <span class="sanvi-payments__code">
                          {payout.external_payout_id}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>
      {/if}

      {#if isStripeEnabled && taxSettings}
        <section class="sanvi-payments__tax" aria-labelledby="sanvi-payments-tax-heading">
          <div class="sanvi-payments__tax-header">
            <h2 id="sanvi-payments-tax-heading" class="sanvi-payments__tax-title">
              {t['admin.payments.taxTitle']()}
            </h2>
            <p class="sanvi-payments__tax-description">
              {t['admin.payments.taxDescription']()}
            </p>
          </div>

          <div class="sanvi-payments__tax-disclaimer">
            <p>{t['admin.payments.taxDisclaimer']()}</p>
          </div>

          {#if taxUpdateError}
            <Alert variant="error">{taxUpdateError}</Alert>
          {/if}

          {#if taxSettings.warning}
            <Alert variant="warning">
              <strong>{t['admin.payments.taxWarningTitle']()}</strong>
              <p>{getTaxWarningMessage(taxSettings.warning.code)}</p>
              <div class="sanvi-payments__tax-warning-date">
                {t['admin.payments.taxWarningDetectedAt']({ date: fmt.datetime(taxSettings.warning.detected_at, 'medium') })}
              </div>
            </Alert>
          {/if}

          <div class="sanvi-payments__tax-preflight-card">
            <div class="sanvi-payments__tax-grid">
              <div class="sanvi-payments__tax-field">
                <span class="sanvi-payments__tax-label">{t['admin.payments.taxRegistrationsLabel']()}</span>
                <strong class="sanvi-payments__tax-value">
                  {t['admin.payments.taxRegistrationsCount']({ count: taxSettings.active_registrations })}
                </strong>
              </div>
              <div class="sanvi-payments__tax-field">
                <span class="sanvi-payments__tax-label">{t['admin.payments.taxProviderStatusLabel']()}</span>
                <span class="sanvi-payments__tax-value">{taxSettings.provider_status}</span>
              </div>
              {#if taxSettings.liability_account}
                <div class="sanvi-payments__tax-field">
                  <span class="sanvi-payments__tax-label">{t['admin.payments.taxLiabilityAccountLabel']()}</span>
                  <span class="sanvi-payments__tax-value sanvi-payments__code">{taxSettings.liability_account}</span>
                </div>
              {/if}
              {#if taxSettings.last_checked_at}
                <div class="sanvi-payments__tax-field">
                  <span class="sanvi-payments__tax-label">{t['admin.payments.taxLastCheckedLabel']()}</span>
                  <span class="sanvi-payments__tax-value">{fmt.datetime(taxSettings.last_checked_at, 'medium')}</span>
                </div>
              {/if}
            </div>
          </div>

          <div class="sanvi-payments__tax-control">
            <Checkbox
              bind:checked={taxCheckboxChecked}
              disabled={toggleDisabled || updatingTax}
              onchange={handleTaxToggleChange}
            >
              {#snippet children()}
                <span>{t['admin.payments.taxToggleLabel']()}</span>
              {/snippet}
            </Checkbox>
            {#if toggleDisabledReason}
              <p class="sanvi-payments__tax-disabled-reason" role="status">
                {toggleDisabledReason}
              </p>
            {/if}
          </div>
        </section>
      {/if}

      {#if isStripeEnabled && platformFee && platformFee.enabled}
        <section class="sanvi-payments__fee" aria-labelledby="sanvi-payments-fee-heading">
          <div class="sanvi-payments__fee-header">
            <h2 id="sanvi-payments-fee-heading" class="sanvi-payments__fee-title">
              {t['admin.payments.feeTitle']()}
            </h2>
            <p class="sanvi-payments__fee-description">
              {t['admin.payments.feeDescription']()}
            </p>
          </div>

          <div class="sanvi-payments__fee-card">
            <div class="sanvi-payments__fee-grid">
              {#if platformFee.basis_points != null}
                <div class="sanvi-payments__fee-field">
                  <span class="sanvi-payments__fee-label">{t['admin.payments.feeRateLabel']()}</span>
                  <strong class="sanvi-payments__fee-value">
                    {(platformFee.basis_points / 100).toFixed(2)}%
                  </strong>
                </div>
              {/if}
              {#if platformFee.fixed_minor != null && feeCurrency}
                <div class="sanvi-payments__fee-field">
                  <span class="sanvi-payments__fee-label">{t['admin.payments.feeFixedLabel']()}</span>
                  <strong class="sanvi-payments__fee-value">
                    {formatMinor(platformFee.fixed_minor, feeCurrency)}
                  </strong>
                </div>
              {/if}
              {#if platformFee.minimum_minor > 0 && feeCurrency}
                <div class="sanvi-payments__fee-field">
                  <span class="sanvi-payments__fee-label">{t['admin.payments.feeMinimumLabel']()}</span>
                  <strong class="sanvi-payments__fee-value">
                    {formatMinor(platformFee.minimum_minor, feeCurrency)}
                  </strong>
                </div>
              {/if}
            </div>
          </div>
        </section>
      {/if}

      {#if taxDisableDialogOpen}
        <Dialog
          bind:open={taxDisableDialogOpen}
          titleText={t['admin.payments.taxDisableDialogTitle']()}
          closeLabel={t['admin.payments.taxDisableDialogClose']()}
        >
          {#snippet children()}
            <Stack gap="3">
              {#if taxUpdateError}
                <Alert variant="error">{taxUpdateError}</Alert>
              {/if}
              <p>{t['admin.payments.taxDisableDialogDescription']()}</p>
            </Stack>
          {/snippet}
          {#snippet footer()}
            <Button
              variant="ghost"
              onclick={cancelDisableTax}
              disabled={updatingTax}
            >
              {t['admin.payments.taxDisableDialogCancel']()}
            </Button>
            <Button
              variant="danger"
              loading={updatingTax}
              loadingLabel={t['admin.payments.taxDisabling']()}
              onclick={confirmDisableTax}
            >
              {t['admin.payments.taxDisableDialogConfirm']()}
            </Button>
          {/snippet}
        </Dialog>
      {/if}

      {#if isStripeEnabled && connection && connection.status !== 'disconnected'}
        <section
          class="sanvi-payments__disconnect"
          aria-labelledby="sanvi-payments-disconnect-heading"
        >
          <div class="sanvi-payments__disconnect-header">
            <h2 id="sanvi-payments-disconnect-heading" class="sanvi-payments__disconnect-title">
              {t['admin.payments.disconnectTitle']()}
            </h2>
            <p class="sanvi-payments__disconnect-description">
              {t['admin.payments.disconnectDescription']()}
            </p>
          </div>

          <div class="sanvi-payments__disconnect-actions">
            <Button
              variant="danger"
              disabled={!hasManagePermission}
              onclick={() => {
                disconnectDialogOpen = true
              }}
            >
              {t['admin.payments.disconnectButton']()}
            </Button>
            {#if !hasManagePermission}
              <p class="sanvi-payments__disconnect-permission-hint" role="status">
                {t['admin.payments.disconnectPermissionDenied']()}
              </p>
            {/if}
          </div>
        </section>
      {/if}

      {#if disconnectDialogOpen}
        <Dialog
          bind:open={disconnectDialogOpen}
          titleText={t['admin.payments.disconnectDialogTitle']()}
        >
          {#snippet children()}
            <Stack gap="4">
              <Alert variant="warning">
                <ul class="sanvi-payments__consequences-list">
                  <li>{t['admin.payments.disconnectConsequenceCheckout']()}</li>
                  <li>{t['admin.payments.disconnectConsequenceHistory']()}</li>
                  <li>{t['admin.payments.disconnectConsequenceAccount']()}</li>
                </ul>
              </Alert>

              {#if disconnectError}
                <Alert variant="error">{disconnectError}</Alert>
              {/if}

              {#if disconnectBlockers.length > 0}
                <Alert variant="error">
                  <strong>{t['admin.payments.disconnectBlockedTitle']()}</strong>
                  <p>{t['admin.payments.disconnectBlockedBody']()}</p>
                  <ul class="sanvi-payments__blocker-list">
                    {#each disconnectBlockers as blocker (blocker.code)}
                      <li>{renderDisconnectBlocker(blocker)}</li>
                    {/each}
                  </ul>
                </Alert>
              {/if}

              <Field
                label={t['admin.payments.disconnectConfirmPrompt']({ phrase: 'DISCONNECT' })}
                required
              >
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={typedDisconnectPhrase}
                    placeholder={t['admin.payments.disconnectInputPlaceholder']()}
                    disabled={disconnecting}
                  />
                {/snippet}
              </Field>
            </Stack>
          {/snippet}
          {#snippet footer()}
            <Button
              variant="ghost"
              onclick={() => {
                disconnectDialogOpen = false
              }}
              disabled={disconnecting}
            >
              {t['admin.payments.disconnectCancelButton']()}
            </Button>
            <Button
              variant="danger"
              disabled={typedDisconnectPhrase.trim() !== 'DISCONNECT' || disconnecting || !hasManagePermission}
              loading={disconnecting}
              loadingLabel={t['admin.payments.disconnecting']()}
              onclick={handleDisconnect}
            >
              {t['admin.payments.disconnectConfirmButton']()}
            </Button>
          {/snippet}
        </Dialog>
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
  .sanvi-payments__management,
  .sanvi-payments__payouts,
  .sanvi-payments__tax,
  .sanvi-payments__fee {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__onboarding-title,
  .sanvi-payments__management-title,
  .sanvi-payments__payouts-title,
  .sanvi-payments__tax-title,
  .sanvi-payments__fee-title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__onboarding-description,
  .sanvi-payments__management-description,
  .sanvi-payments__payouts-description,
  .sanvi-payments__tax-description,
  .sanvi-payments__fee-description {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
    text-align: start;
  }

  .sanvi-payments__table th {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    text-align: start;
  }

  .sanvi-payments__table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
    vertical-align: middle;
  }

  .sanvi-payments__table tbody tr:last-child td {
    border-block-end: none;
  }

  .sanvi-payments__amount {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-payments__date {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__code {
    font-family: monospace;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__tax-disclaimer {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-secondary);
    border-radius: var(--sanvi-radius-md);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-default);
  }

  .sanvi-payments__tax-disclaimer p {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    line-height: 1.5;
  }

  .sanvi-payments__tax-warning-date {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    margin-block-start: var(--sanvi-spacing-1);
  }

  .sanvi-payments__tax-preflight-card,
  .sanvi-payments__fee-card {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-payments__tax-grid,
  .sanvi-payments__fee-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(calc(var(--sanvi-spacing-32) + var(--sanvi-spacing-16)), 1fr)
    );
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-payments__tax-field,
  .sanvi-payments__fee-field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payments__tax-label,
  .sanvi-payments__fee-label {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__tax-value,
  .sanvi-payments__fee-value {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__tax-control {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    margin-block-start: var(--sanvi-spacing-2);
  }

  .sanvi-payments__tax-disabled-reason {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-solid-error-base);
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

  .sanvi-payments__disconnect {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payments__disconnect-title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payments__disconnect-description {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payments__disconnect-actions {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    align-items: flex-start;
  }

  .sanvi-payments__disconnect-permission-hint {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-solid-error-base);
  }

  .sanvi-payments__consequences-list,
  .sanvi-payments__blocker-list {
    margin: var(--sanvi-spacing-2) 0 0;
    padding-inline-start: var(--sanvi-spacing-4);
    font-size: var(--sanvi-font-size-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }
</style>

