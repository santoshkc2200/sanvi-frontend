<script lang="ts">
import {
  ApiError,
  getDomainInstructions,
  listCustomDomains,
  listDomainOrders,
  promoteDomain,
  removeCustomDomain,
  setOrderAutoRenew,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { currentLocale, fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  Dialog,
  DomainRecordTable,
  type DomainRecordItem,
  Field,
  Input,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { failureMessage as failureMessageFor, toRecordItems } from '../lib/domains/records'

type CustomDomainView = components['schemas']['CustomDomainView']
type InstructionsView = components['schemas']['InstructionsView']
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
let instructions = $state<InstructionsView | null>(null)
let updatingAutoRenew = $state(false)
let autoRenewError = $state<string | undefined>(undefined)

let promoteDialogOpen = $state(false)
let promoting = $state(false)
let promoteError = $state<string | undefined>(undefined)

let removeDialogOpen = $state(false)
let removing = $state(false)
let removeError = $state<string | undefined>(undefined)
let typedHostname = $state('')

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
      // The expected-vs-observed table is the page's whole point, so its
      // expected side comes from the backend rather than being guessed here.
      instructions = await getDomainInstructions(apiClient, match.id, {
        locale: currentLocale(),
      }).catch(() => null)
      if (seq !== loadSeq) return
    } else {
      domain = null
      order = null
      instructions = null
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

const domainRecords = $derived<DomainRecordItem[]>(toRecordItems(instructions, domain))

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

const failureMessage = $derived(failureMessageFor(domain?.failure))

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

async function handlePromoteDomain(): Promise<void> {
  if (!domain) return
  promoting = true
  promoteError = undefined
  try {
    await promoteDomain(apiClient, domain.id)
    promoteDialogOpen = false
    // Promotion demotes whichever domain was primary before, so re-read rather
    // than patching this one's role and leaving the other stale.
    await load()
  } catch {
    promoteError = t['admin.domains.genericError']()
  } finally {
    promoting = false
  }
}

async function handleRemoveDomain(): Promise<void> {
  if (!domain || typedHostname !== domain.hostname) return
  removing = true
  removeError = undefined
  try {
    await removeCustomDomain(apiClient, domain.id)
    removeDialogOpen = false
    if (typeof window !== 'undefined') {
      window.location.href = '/domains'
    }
  } catch {
    removeError = t['admin.domains.genericError']()
  } finally {
    removing = false
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
          ttlHeader={t['admin.domains.detail.recordsTtlHeader']()}
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
                      {order?.auto_renew
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
              disabled={domain.role === 'primary'}
              title={domain.role === 'primary' ? t['admin.domains.detail.isAlreadyPrimary']() : undefined}
              onclick={() => {
                promoteError = undefined
                promoteDialogOpen = true
              }}
            >
              {t['admin.domains.detail.makePrimary']()}
            </Button>
            <Button
              variant="danger"
              onclick={() => {
                removeError = undefined
                typedHostname = ''
                removeDialogOpen = true
              }}
            >
              {t['admin.domains.detail.removeDomain']()}
            </Button>
          </Cluster>
        </div>
      </section>

      <!-- Promote Primary Confirmation Dialog -->
      {#if promoteDialogOpen}
        <Dialog bind:open={promoteDialogOpen} titleText={t['admin.domains.detail.promoteTitle']()}>
          {#snippet children()}
            <Stack gap="4">
              <Alert variant="warning">
                {t['admin.domains.detail.promoteSeoWarning']()}
              </Alert>
              <p class="sanvi-domain-detail__dialog-text">
                {t['admin.domains.detail.promoteUrlPreview']({ hostname: domain?.hostname ?? '' })}
              </p>
              {#if promoteError}
                <Alert variant="error">{promoteError}</Alert>
              {/if}
            </Stack>
          {/snippet}
          {#snippet footer()}
            <Button variant="ghost" onclick={() => (promoteDialogOpen = false)}>
              {t['admin.domains.detail.cancelButton']()}
            </Button>
            <Button
              variant="primary"
              loading={promoting}
              loadingLabel={t['admin.domains.detail.promoting']()}
              onclick={handlePromoteDomain}
            >
              {t['admin.domains.detail.promoteConfirmButton']()}
            </Button>
          {/snippet}
        </Dialog>
      {/if}

      <!-- Remove Domain Typed Confirmation Dialog -->
      {#if removeDialogOpen}
        <Dialog bind:open={removeDialogOpen} titleText={t['admin.domains.detail.removeTitle']()}>
          {#snippet children()}
            <Stack gap="4">
              <Alert variant="error">
                {t['admin.domains.detail.removeConsequence']({ hostname: domain?.hostname ?? '' })}
              </Alert>
              {#if removeError}
                <Alert variant="error">{removeError}</Alert>
              {/if}
              <Field
                label={t['admin.domains.detail.removeConfirmPrompt']({ hostname: domain?.hostname ?? '' })}
                required
              >
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={typedHostname}
                    placeholder={t['admin.domains.detail.removeInputPlaceholder']()}
                    disabled={removing}
                  />
                {/snippet}
              </Field>
            </Stack>
          {/snippet}
          {#snippet footer()}
            <Button
              variant="ghost"
              onclick={() => {
                removeDialogOpen = false
                typedHostname = ''
              }}
            >
              {t['admin.domains.detail.cancelButton']()}
            </Button>
            <Button
              variant="danger"
              disabled={!domain || typedHostname !== domain.hostname || removing}
              loading={removing}
              loadingLabel={t['admin.domains.detail.removing']()}
              onclick={handleRemoveDomain}
            >
              {t['admin.domains.detail.removeConfirmButton']()}
            </Button>
          {/snippet}
        </Dialog>
      {/if}
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

  .sanvi-domain-detail__dialog-text {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
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
