<script lang="ts">
import { ApiError, listCustomDomains, listDomainOrders, setOrderAutoRenew } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DomainRecordTable,
  type DomainRecordItem,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type CustomDomainView = components['schemas']['CustomDomainView']
type OrderView = components['schemas']['OrderView']

interface Props {
  id?: string
}

let { id: propId }: Props = $props()

const targetId = $derived(
  propId ||
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('id') ?? '')
      : ''),
)

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let domain = $state<CustomDomainView | null>(null)
let order = $state<OrderView | null>(null)
let updatingAutoRenew = $state(false)
let autoRenewError = $state<string | undefined>(undefined)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  autoRenewError = undefined

  try {
    const [list, orderList] = await Promise.all([
      listCustomDomains(apiClient),
      listDomainOrders(apiClient).catch(() => []),
    ])
    if (seq !== loadSeq) return
    const match = (list ?? []).find((d) => d.id === targetId || d.hostname === targetId)
    if (match) {
      domain = match
      order = (orderList ?? []).find((o) => o.hostname === match.hostname) ?? null
    } else {
      domain = null
      order = null
      error = t['admin.domains.detail.notFoundTitle']()
    }
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError) {
      error = t['admin.domains.genericError']()
    } else {
      error = t['admin.domains.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

const currentStep = $derived.by(() => {
  if (!domain) return 1
  switch (domain.status) {
    case 'pending_setup':
      return 1
    case 'verifying':
      return 2
    case 'verified':
      return 3
    case 'issuing_cert':
      return 4
    case 'live':
    case 'degraded':
      return 5
    case 'removed':
      return 0
    default:
      return 1
  }
})

const domainRecords = $derived.by<DomainRecordItem[]>(() => {
  if (!domain) return []
  const items: DomainRecordItem[] = []

  const txtName = domain.challenge?.txt_name || `_sanvi-challenge.${domain.hostname}`
  const txtValue =
    domain.challenge?.txt_value ||
    (domain.challenge?.token
      ? `sanvi-verification=${domain.challenge.token}`
      : `sanvi-verification=${domain.id}`)

  let txtObserved: DomainRecordItem['observed'] = 'pending'
  if (['live', 'verified', 'issuing_cert'].includes(domain.status)) {
    txtObserved = 'matched'
  } else if (
    domain.failure?.code === 'txt_missing' ||
    domain.failure?.code === 'challenge_expired'
  ) {
    txtObserved = 'not_found'
  } else if (domain.failure?.code === 'dns_drift' || domain.failure?.code === 'txt_mismatch') {
    txtObserved = 'mismatch'
  }

  items.push({
    type: 'TXT',
    name: txtName,
    expected: txtValue,
    observed: txtObserved,
  })

  const isSubdomain = domain.hostname.split('.').length > 2
  const routingType = isSubdomain ? 'CNAME' : 'A'
  const routingTarget = isSubdomain ? 'edge.sanvi.app' : '192.0.2.1'

  let routingObserved: DomainRecordItem['observed'] = 'pending'
  if (
    domain.status === 'live' ||
    domain.status === 'verified' ||
    domain.status === 'issuing_cert'
  ) {
    routingObserved = 'matched'
  } else if (domain.failure?.code === 'routing_missing') {
    routingObserved = 'not_found'
  } else if (domain.failure?.code === 'routing_mismatch') {
    routingObserved = 'mismatch'
  }

  items.push({
    type: routingType,
    name: domain.hostname,
    expected: routingTarget,
    observed: routingObserved,
  })

  return items
})

function getRoleLabel(role: string): string {
  switch (role) {
    case 'primary':
      return t['admin.domains.rolePrimary']()
    case 'redirect':
      return t['admin.domains.roleRedirect']()
    default:
      return t['admin.domains.roleAlias']()
  }
}

function getStatusVariant(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'live':
      return 'success'
    case 'verified':
    case 'issuing_cert':
      return 'info'
    case 'degraded':
      return 'warning'
    case 'removed':
      return 'error'
    default:
      return 'neutral'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'live':
      return t['admin.domains.statusLive']()
    case 'verified':
      return t['admin.domains.statusVerified']()
    case 'issuing_cert':
      return t['admin.domains.statusIssuingCert']()
    case 'degraded':
      return t['admin.domains.statusDegraded']()
    case 'removed':
      return t['admin.domains.statusRemoved']()
    case 'verifying':
      return t['admin.domains.statusVerifying']()
    default:
      return t['admin.domains.statusPendingSetup']()
  }
}

const failureMessage = $derived.by(() => {
  if (!domain?.failure) return undefined
  switch (domain.failure.code) {
    case 'txt_missing':
      return t['admin.domains.failure.txtMissing']()
    case 'txt_mismatch':
      return t['admin.domains.failure.txtMismatch']()
    case 'routing_missing':
      return t['admin.domains.failure.routingMissing']()
    case 'routing_mismatch':
      return t['admin.domains.failure.routingMismatch']()
    case 'dns_drift':
      return t['admin.domains.failure.dnsDrift']()
    case 'challenge_expired':
      return t['admin.domains.failure.challengeExpired']()
    case 'verified_by_other_tenant':
      return t['admin.domains.failure.verifiedByOtherTenant']()
    case 'cert_invalid':
      return t['admin.domains.failure.certInvalid']()
    case 'cert_issuance_failed':
      return t['admin.domains.failure.certIssuanceFailed']()
    case 'propagating':
      return t['admin.domains.failure.propagating']()
    case 'probe_failed':
      return t['admin.domains.failure.probeFailed']()
    default:
      return domain.failure.detail || t['admin.domains.failure.generic']()
  }
})

const daysUntilExpiry = $derived.by(() => {
  if (!order?.expires_at) return null
  const exp = new Date(order.expires_at).getTime()
  const now = Date.now()
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
})

const isExpiringSoon = $derived(daysUntilExpiry !== null && daysUntilExpiry <= 30)

async function handleToggleAutoRenew(): Promise<void> {
  if (!order) return
  updatingAutoRenew = true
  autoRenewError = undefined
  const nextVal = !order.auto_renew
  try {
    await setOrderAutoRenew(apiClient, order.id, nextVal)
    order = { ...order, auto_renew: nextVal }
  } catch {
    autoRenewError = t['admin.domains.genericError']()
  } finally {
    updatingAutoRenew = false
  }
}

const roleLabel = $derived(domain ? getRoleLabel(domain.role) : '')
const statusLabel = $derived(domain ? getStatusLabel(domain.status) : '')
const certBadgeLabel = $derived(
  domain?.status === 'live'
    ? t['admin.domains.statusLive']()
    : t['admin.domains.statusIssuingCert'](),
)
</script>

<svelte:head>
  <title>{domain?.hostname ? `${domain.hostname} — ${t['admin.domains.title']()}` : t['admin.domains.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <a class="sanvi-domain-detail__back-link" href="/domains">
        ← {t['admin.domains.detail.backLink']()}
      </a>
    </div>

    {#if loading}
      <Spinner label={t['admin.domains.loading']()} />
    {:else if error && !domain}
      <Alert variant="error">
        <strong>{error}</strong>
        <p>{t['admin.domains.detail.notFoundDescription']()}</p>
      </Alert>
    {:else if domain}
      <div class="sanvi-domain-detail__header">
        <Cluster justify="space-between" align="center" gap="4">
          <Stack gap="1">
            <h1>{domain.hostname}</h1>
            <Cluster gap="2" align="center">
              <Badge variant="neutral">
                {#snippet children()}
                  {roleLabel}
                {/snippet}
              </Badge>
              <Badge variant={getStatusVariant(domain.status)}>
                {#snippet children()}
                  {statusLabel}
                {/snippet}
              </Badge>
              {#if domain.status === 'degraded'}
                <Badge variant="warning">
                  {#snippet children()}
                    {t['admin.domains.healthDegraded']()}
                  {/snippet}
                </Badge>
              {:else if domain.status === 'live'}
                <Badge variant="success">
                  {#snippet children()}
                    {t['admin.domains.healthHealthy']()}
                  {/snippet}
                </Badge>
              {/if}
              {#if domain.detected_registrar}
                <span class="sanvi-domain-detail__registrar">
                  {t['admin.domains.detail.detectedRegistrar']({ provider: domain.detected_registrar })}
                </span>
              {/if}
            </Cluster>
          </Stack>
        </Cluster>
      </div>

      {#if domain.status === 'degraded'}
        <Alert variant="warning">
          <strong>{t['admin.domains.healthDegraded']()}</strong>
          <p>{failureMessage || t['admin.domains.healthDegradedExplanation']()}</p>
        </Alert>
      {/if}

      {#if isExpiringSoon && order?.expires_at}
        <Alert variant="warning">
          <strong>{t['admin.domains.expiry.warningTitle']()}</strong>
          <p>
            {t['admin.domains.expiry.warningMessage']({
              date: fmt.date(order.expires_at, 'medium'),
              days: Math.max(0, daysUntilExpiry ?? 0),
            })}
          </p>
          <p>
            {order.auto_renew
              ? t['admin.domains.expiry.autoRenewEnabledNotice']()
              : t['admin.domains.expiry.autoRenewDisabledNotice']()}
          </p>
        </Alert>
      {/if}

      <!-- Status timeline (claimed -> verifying -> verified -> issuing -> live) -->
      <section class="sanvi-domain-detail__section" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">{t['admin.domains.detail.timelineTitle']()}</h2>
        <ol class="sanvi-domain-timeline">
          <li class="sanvi-domain-timeline__step" class:sanvi-domain-timeline__step--complete={currentStep >= 1} class:sanvi-domain-timeline__step--active={currentStep === 1}>
            <span class="sanvi-domain-timeline__badge">1</span>
            <span class="sanvi-domain-timeline__label">{t['admin.domains.detail.timelineClaimed']()}</span>
          </li>
          <li class="sanvi-domain-timeline__step" class:sanvi-domain-timeline__step--complete={currentStep >= 2} class:sanvi-domain-timeline__step--active={currentStep === 2}>
            <span class="sanvi-domain-timeline__badge">2</span>
            <span class="sanvi-domain-timeline__label">{t['admin.domains.detail.timelineVerifying']()}</span>
          </li>
          <li class="sanvi-domain-timeline__step" class:sanvi-domain-timeline__step--complete={currentStep >= 3} class:sanvi-domain-timeline__step--active={currentStep === 3}>
            <span class="sanvi-domain-timeline__badge">3</span>
            <span class="sanvi-domain-timeline__label">{t['admin.domains.detail.timelineVerified']()}</span>
          </li>
          <li class="sanvi-domain-timeline__step" class:sanvi-domain-timeline__step--complete={currentStep >= 4} class:sanvi-domain-timeline__step--active={currentStep === 4}>
            <span class="sanvi-domain-timeline__badge">4</span>
            <span class="sanvi-domain-timeline__label">{t['admin.domains.detail.timelineIssuing']()}</span>
          </li>
          <li class="sanvi-domain-timeline__step" class:sanvi-domain-timeline__step--complete={currentStep >= 5} class:sanvi-domain-timeline__step--active={currentStep === 5}>
            <span class="sanvi-domain-timeline__badge">5</span>
            <span class="sanvi-domain-timeline__label">{t['admin.domains.detail.timelineLive']()}</span>
          </li>
        </ol>
      </section>

      <!-- Expected vs observed DNS Record Table: first element for diagnosing configuration issues -->
      <section class="sanvi-domain-detail__section" aria-labelledby="dns-records-heading">
        <h2 id="dns-records-heading">{t['admin.domains.detail.recordsTitle']()}</h2>
        <p class="sanvi-domain-detail__section-desc">{t['admin.domains.detail.recordsDescription']()}</p>
        
        <DomainRecordTable
          records={domainRecords}
          typeHeader={t['admin.domains.detail.recordsTypeHeader']()}
          nameHeader={t['admin.domains.detail.recordsNameHeader']()}
          expectedHeader={t['admin.domains.detail.recordsValueHeader']()}
          statusHeader={t['admin.domains.detail.recordsStatusHeader']()}
          actionsHeader={t['admin.domains.detail.recordsActionsHeader']()}
          copyLabel={t['admin.domains.detail.copy']()}
          copiedLabel={t['admin.domains.detail.copied']()}
          copyAllLabel={t['admin.domains.detail.copyAll']()}
          copyAllCopiedLabel={t['admin.domains.detail.copyAllCopied']()}
          emptyMessage={t['admin.domains.detail.noRecords']()}
          statusMatchedLabel={t['admin.domains.detail.recordMatched']()}
          statusPendingLabel={t['admin.domains.detail.recordPending']()}
          statusMismatchLabel={t['admin.domains.detail.recordMismatch']()}
          statusNotFoundLabel={t['admin.domains.detail.recordNotFound']()}
        />
      </section>

      <!-- Security Notice Panel -->
      <div class="sanvi-domain-detail__security-notice">
        <strong>{t['admin.domains.detail.securityNoticeTitle']()}</strong>
        <p>{t['admin.domains.detail.securityNotice']()}</p>
      </div>

      <!-- Certificate info -->
      <section class="sanvi-domain-detail__section" aria-labelledby="cert-heading">
        <h2 id="cert-heading">{t['admin.domains.detail.certTitle']()}</h2>
        <div class="sanvi-domain-detail__card">
          <Cluster justify="space-between" align="center">
            <span>
              {domain.status === 'live'
                ? t['admin.domains.detail.certLive']()
                : t['admin.domains.detail.certPending']()}
            </span>
            <Badge variant={domain.status === 'live' ? 'success' : 'info'}>
              {#snippet children()}
                {certBadgeLabel}
              {/snippet}
            </Badge>
          </Cluster>
        </div>
      </section>

      <!-- Registration & Renewal info (if purchased / order exists) -->
      {#if order}
        <section class="sanvi-domain-detail__section" aria-labelledby="renewal-heading">
          <h2 id="renewal-heading">{t['admin.domains.expiry.sectionTitle']()}</h2>
          <div class="sanvi-domain-detail__card">
            <Stack gap="4">
              {#if autoRenewError}
                <Alert variant="error">{autoRenewError}</Alert>
              {/if}
              <Cluster justify="space-between" align="center" gap="4">
                <Stack gap="1">
                  {#if order.expires_at}
                    <span class="sanvi-domain-detail__meta-line">
                      {t['admin.domains.expiry.expiresOn']({ date: fmt.date(order.expires_at, 'medium') })}
                    </span>
                  {/if}
                  {#if order.registered_at}
                    <span class="sanvi-domain-detail__meta-subtext">
                      {t['admin.domains.expiry.registeredOn']({ date: fmt.date(order.registered_at, 'medium') })}
                    </span>
                  {/if}
                </Stack>
                <Cluster gap="3" align="center">
                  <Badge variant={order.auto_renew ? 'success' : 'neutral'}>
                    {#snippet children()}
                      {order.auto_renew
                        ? t['admin.domains.expiry.autoRenewEnabled']()
                        : t['admin.domains.expiry.autoRenewDisabled']()}
                    {/snippet}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={updatingAutoRenew}
                    loadingLabel={t['admin.domains.expiry.updatingAutoRenew']()}
                    onclick={handleToggleAutoRenew}
                  >
                    {order.auto_renew
                      ? t['admin.domains.expiry.disableAutoRenew']()
                      : t['admin.domains.expiry.enableAutoRenew']()}
                  </Button>
                </Cluster>
              </Cluster>
              <p class="sanvi-domain-detail__section-desc">
                {t['admin.domains.expiry.autoRenewBillingHint']()}
              </p>
            </Stack>
          </div>
        </section>
      {/if}

      <!-- Danger zone -->
      <section class="sanvi-domain-detail__section sanvi-domain-detail__danger-zone" aria-labelledby="danger-heading">
        <h2 id="danger-heading">{t['admin.domains.detail.dangerTitle']()}</h2>
        <div class="sanvi-domain-detail__card">
          <Cluster justify="space-between" align="center" gap="4">
            <Button
              variant="secondary"
              disabled
              title={t['admin.domains.detail.makePrimaryDisabledTooltip']()}
            >
              <!-- Primary domain switching is wired in Wave 4 -->
              {t['admin.domains.detail.makePrimary']()}
            </Button>
            <Button
              variant="danger"
              disabled
              title={t['admin.domains.detail.removeDomainDisabledTooltip']()}
            >
              <!-- Domain removal is wired in Wave 4 -->
              {t['admin.domains.detail.removeDomain']()}
            </Button>
          </Cluster>
        </div>
      </section>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-domain-detail__back-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-domain-detail__back-link:hover {
    text-decoration: underline;
  }

  .sanvi-domain-detail__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-domain-detail__registrar {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-domain-detail__section {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-domain-detail__section h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-domain-detail__section-desc {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-domain-detail__meta-line {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-domain-detail__meta-subtext {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-domain-detail__card {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-domain-detail__security-notice {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-solid-primary-base);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-domain-detail__security-notice strong {
    color: var(--sanvi-color-text-primary);
    display: block;
    margin-block-end: var(--sanvi-spacing-1);
  }

  .sanvi-domain-detail__security-notice p {
    margin: 0;
  }

  .sanvi-domain-detail__danger-zone {
    margin-block-start: var(--sanvi-spacing-4);
  }

  /* Timeline */
  .sanvi-domain-timeline {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: var(--sanvi-spacing-2);
    overflow-x: auto;
  }

  .sanvi-domain-timeline__step {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-domain-timeline__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-5);
    height: var(--sanvi-spacing-5);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-bold);
    flex-shrink: 0;
  }

  .sanvi-domain-timeline__step--complete {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-domain-timeline__step--complete .sanvi-domain-timeline__badge {
    background: var(--sanvi-color-solid-success-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-domain-timeline__step--active {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-domain-timeline__step--active .sanvi-domain-timeline__badge {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-domain-timeline__label {
    white-space: nowrap;
  }
</style>
