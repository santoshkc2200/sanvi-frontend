<script lang="ts">
import { ApiError, getTenantPayment } from '@sanvi/api-client'
import type { PaymentDetailView, RefundView } from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { formatMinor } from '@sanvi/billing-elements'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Badge, Button, Cluster, Container, Spinner, Stack } from '@sanvi/ui'
import { apiClient } from '../lib/api'
import DisputeDisplay from '../lib/payments/DisputeDisplay.svelte'
import RefundDialog from '../lib/payments/RefundDialog.svelte'

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
let detail = $state<PaymentDetailView | null>(null)
let refundDialogOpen = $state(false)

let loadSeq = 0

async function load(): Promise<void> {
  if (!targetId) {
    loading = false
    error = t['admin.payments.detail.notFoundTitle']()
    return
  }

  const seq = ++loadSeq
  loading = true
  error = undefined

  try {
    const result = await getTenantPayment(apiClient, targetId)
    if (seq !== loadSeq) return
    detail = result
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && err.status === 404) {
      detail = null
      error = t['admin.payments.detail.notFoundTitle']()
    } else {
      error = t['admin.payments.list.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

const payment = $derived(detail?.payment)
const refunds = $derived(detail?.refunds ?? [])
const disputes = $derived(detail?.disputes ?? [])
const timeline = $derived(detail?.timeline ?? [])

const totalRefundedMinor = $derived.by(() => {
  return refunds.reduce((sum, r) => sum + r.amount_minor, 0)
})

const remainingRefundableMinor = $derived.by(() => {
  if (!payment) return 0
  return Math.max(0, payment.amount_minor - totalRefundedMinor)
})

const canRefund = $derived.by(() => {
  if (!can('payments.refund', getActiveTenantId())) return false
  if (!payment) return false
  if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') return false
  return remainingRefundableMinor > 0
})

const hasRefundPermission = $derived(can('payments.refund', getActiveTenantId()))

function getStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'error'
    case 'disputed':
      return 'warning'
    case 'partially_refunded':
      return 'info'
    case 'refunded':
      return 'neutral'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'succeeded':
      return t['admin.payments.list.statusSucceeded']()
    case 'failed':
      return t['admin.payments.list.statusFailed']()
    case 'disputed':
      return t['admin.payments.list.statusDisputed']()
    case 'refunded':
      return t['admin.payments.list.statusRefunded']()
    case 'partially_refunded':
      return t['admin.payments.list.statusPartiallyRefunded']()
    case 'pending':
      return t['admin.payments.list.statusPending']()
    case 'canceled':
      return t['admin.payments.list.statusCanceled']()
    default:
      return status
  }
}

function getPayoutStatusLabel(payoutStatus?: string | null): string {
  if (!payoutStatus) return '—'
  switch (payoutStatus) {
    case 'paid':
      return t['admin.payments.list.payoutPaid']()
    case 'pending':
      return t['admin.payments.list.payoutPending']()
    case 'failed':
      return t['admin.payments.list.payoutFailed']()
    default:
      return payoutStatus
  }
}

function getTimelineKindLabel(kind: string): string {
  switch (kind) {
    case 'created':
      return t['admin.payments.detail.timelineCreated']()
    case 'succeeded':
      return t['admin.payments.detail.timelineSucceeded']()
    case 'failed':
      return t['admin.payments.detail.timelineFailed']()
    case 'canceled':
      return t['admin.payments.detail.timelineCanceled']()
    case 'refunded':
      return t['admin.payments.detail.timelineRefunded']()
    case 'disputed':
      return t['admin.payments.detail.timelineDisputed']()
    case 'dispute_closed':
      return t['admin.payments.detail.timelineDisputeClosed']()
    case 'paid_out':
      return t['admin.payments.detail.timelinePaidOut']()
    default:
      return kind
  }
}

function getTimelineKindVariant(
  kind: string,
): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  switch (kind) {
    case 'succeeded':
    case 'paid_out':
      return 'success'
    case 'failed':
      return 'error'
    case 'disputed':
      return 'warning'
    case 'refunded':
    case 'dispute_closed':
      return 'info'
    default:
      return 'neutral'
  }
}

function handleRefundSuccess(_refund: RefundView): void {
  void load()
}
</script>

<svelte:head>
  <title>{payment ? `${t['admin.payments.detail.title']({ id: payment.id })}` : t['admin.payments.list.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <a class="sanvi-payment-detail__back-link" href="/payments">
        ← {t['admin.payments.detail.backLink']()}
      </a>
    </div>

    {#if loading}
      <Spinner label={t['admin.payments.loading']()} />
    {:else if error && !payment}
      <Alert variant="error">
        <strong>{error}</strong>
        <p>{t['admin.payments.detail.notFoundDescription']()}</p>
      </Alert>
    {:else if payment}
      <div class="sanvi-payment-detail__header">
        <Cluster justify="space-between" align="center" gap="4">
          <Stack gap="1">
            <Cluster gap="3" align="center">
              <h1>{formatMinor(payment.amount_minor, payment.currency)}</h1>
              <Badge variant={getStatusVariant(payment.status)}>
                {#snippet children()}
                  {getStatusLabel(payment.status)}
                {/snippet}
              </Badge>
              {#if remainingRefundableMinor === 0 && totalRefundedMinor > 0}
                <Badge variant="neutral">
                  {#snippet children()}
                    {t['admin.payments.detail.fullyRefunded']()}
                  {/snippet}
                </Badge>
              {/if}
            </Cluster>
            <span class="sanvi-payment-detail__id-text">
              {payment.id}
            </span>
          </Stack>

          {#if hasRefundPermission && canRefund}
            <Button
              variant="secondary"
              onclick={() => {
                refundDialogOpen = true
              }}
            >
              {t['admin.payments.detail.refundAction']()}
            </Button>
          {/if}
        </Cluster>
      </div>

      {#if payment.failure_code || payment.failure_message}
        <Alert variant="error">
          {#if payment.failure_code}
            <strong>{t['admin.payments.detail.failureCodeLabel']()}: {payment.failure_code}</strong>
          {/if}
          {#if payment.failure_message}
            <p>{payment.failure_message}</p>
          {/if}
        </Alert>
      {/if}

      <!-- Payment Summary Section -->
      <section class="sanvi-payment-detail__section" aria-labelledby="sanvi-summary-heading">
        <h2 id="sanvi-summary-heading">{t['admin.payments.detail.summaryTitle']()}</h2>
        <div class="sanvi-payment-detail__card">
          <div class="sanvi-payment-detail__grid">
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.amountLabel']()}</span>
              <strong class="sanvi-payment-detail__value">{formatMinor(payment.amount_minor, payment.currency)}</strong>
            </div>
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.statusLabel']()}</span>
              <span class="sanvi-payment-detail__value">{getStatusLabel(payment.status)}</span>
            </div>
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.externalIdLabel']()}</span>
              <span class="sanvi-payment-detail__value sanvi-payment-detail__code">{payment.external_payment_id}</span>
            </div>
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.customerLabel']()}</span>
              <span class="sanvi-payment-detail__value">{detail?.checkout_reference || payment.checkout_id || '—'}</span>
            </div>
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.createdAtLabel']()}</span>
              <span class="sanvi-payment-detail__value">{payment.created_at ? fmt.datetime(payment.created_at, 'medium') : '—'}</span>
            </div>
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.capturedAtLabel']()}</span>
              <span class="sanvi-payment-detail__value">{payment.captured_at ? fmt.datetime(payment.captured_at, 'medium') : '—'}</span>
            </div>
            {#if payment.fee_minor != null}
              <div class="sanvi-payment-detail__field">
                <span class="sanvi-payment-detail__label">{t['admin.payments.detail.feeLabel']()}</span>
                <span class="sanvi-payment-detail__value">{formatMinor(payment.fee_minor, payment.fee_currency || payment.currency)}</span>
              </div>
            {/if}
            <div class="sanvi-payment-detail__field">
              <span class="sanvi-payment-detail__label">{t['admin.payments.detail.payoutStatusLabel']()}</span>
              <span class="sanvi-payment-detail__value">{getPayoutStatusLabel(payment.payout_status)}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Dispute Display -->
      {#if disputes.length > 0}
        <DisputeDisplay {disputes} />
      {/if}

      <!-- Refunds History Section -->
      {#if refunds.length > 0}
        <section class="sanvi-payment-detail__section" aria-labelledby="sanvi-refunds-heading">
          <h2 id="sanvi-refunds-heading">{t['admin.payments.detail.refundsSectionTitle']()}</h2>
          <div class="sanvi-payment-detail__table-wrapper">
            <table class="sanvi-payment-detail__table">
              <thead>
                <tr>
                  <th scope="col">{t['admin.payments.detail.refundColId']()}</th>
                  <th scope="col">{t['admin.payments.detail.refundColAmount']()}</th>
                  <th scope="col">{t['admin.payments.detail.refundColDate']()}</th>
                  <th scope="col">{t['admin.payments.detail.refundColReason']()}</th>
                  <th scope="col">{t['admin.payments.detail.refundColBy']()}</th>
                  <th scope="col">{t['admin.payments.detail.refundColStatus']()}</th>
                </tr>
              </thead>
              <tbody>
                {#each refunds as refund (refund.id)}
                  <tr>
                    <td><span class="sanvi-payment-detail__code">{refund.id}</span></td>
                    <td><strong>{formatMinor(refund.amount_minor, refund.currency)}</strong></td>
                    <td><span class="sanvi-payment-detail__muted">{fmt.datetime(refund.created_at, 'medium')}</span></td>
                    <td>{refund.reason || '—'}</td>
                    <td><span class="sanvi-payment-detail__muted">{refund.created_by || '—'}</span></td>
                    <td>
                      <Badge variant={refund.status === 'succeeded' ? 'success' : 'neutral'}>
                        {#snippet children()}
                          {refund.status}
                        {/snippet}
                      </Badge>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      <!-- Timeline Projection Section (Rendered as-is from API) -->
      <section class="sanvi-payment-detail__section" aria-labelledby="sanvi-timeline-heading">
        <h2 id="sanvi-timeline-heading">{t['admin.payments.detail.timelineTitle']()}</h2>
        {#if timeline.length === 0}
          <p class="sanvi-payment-detail__muted">{t['admin.payments.detail.timelineEmpty']()}</p>
        {:else}
          <div class="sanvi-timeline">
            {#each timeline as item, index (`${item.kind}-${item.at}-${index}`)}
              <div class="sanvi-timeline__item">
                <div class="sanvi-timeline__marker-col">
                  <div class="sanvi-timeline__marker sanvi-timeline__marker--{getTimelineKindVariant(item.kind)}"></div>
                  {#if index < timeline.length - 1}
                    <div class="sanvi-timeline__line"></div>
                  {/if}
                </div>
                <div class="sanvi-timeline__content">
                  <Cluster justify="space-between" align="center" gap="2">
                    <strong class="sanvi-timeline__title">{getTimelineKindLabel(item.kind)}</strong>
                    <span class="sanvi-timeline__time">{fmt.datetime(item.at, 'medium')}</span>
                  </Cluster>
                  {#if item.amount}
                    <span class="sanvi-timeline__amount">
                      {formatMinor(item.amount.amount_minor, item.amount.currency)}
                    </span>
                  {/if}
                  {#if item.detail}
                    <p class="sanvi-timeline__detail">{item.detail}</p>
                  {/if}
                  {#if item.actor}
                    <span class="sanvi-timeline__actor">{item.actor}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Refund Dialog Component -->
      {#if refundDialogOpen && payment}
        <RefundDialog
          bind:open={refundDialogOpen}
          {payment}
          {refunds}
          onSuccess={handleRefundSuccess}
        />
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-payment-detail__back-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-payment-detail__back-link:hover {
    text-decoration: underline;
  }

  .sanvi-payment-detail__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-detail__id-text {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    font-family: monospace;
  }

  .sanvi-payment-detail__section {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payment-detail__section h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-detail__card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payment-detail__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--sanvi-spacing-32) + var(--sanvi-spacing-16)), 1fr));
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-payment-detail__field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payment-detail__label {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-detail__value {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-detail__code {
    font-family: monospace;
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-payment-detail__muted {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-payment-detail__table-wrapper {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payment-detail__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
    text-align: start;
  }

  .sanvi-payment-detail__table th {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    text-align: start;
  }

  .sanvi-payment-detail__table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
    vertical-align: middle;
  }

  .sanvi-payment-detail__table tbody tr:last-child td {
    border-block-end: none;
  }

  /* Timeline */
  .sanvi-timeline {
    display: flex;
    flex-direction: column;
  }

  .sanvi-timeline__item {
    display: flex;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-timeline__marker-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: var(--sanvi-spacing-4);
  }

  .sanvi-timeline__marker {
    width: var(--sanvi-spacing-3);
    height: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-full);
    margin-block-start: var(--sanvi-spacing-1);
    background: var(--sanvi-color-background-tertiary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-timeline__marker--success {
    background: var(--sanvi-color-solid-success-base);
    border-color: var(--sanvi-color-solid-success-base);
  }

  .sanvi-timeline__marker--error {
    background: var(--sanvi-color-solid-error-base);
    border-color: var(--sanvi-color-solid-error-base);
  }

  .sanvi-timeline__marker--warning {
    background: var(--sanvi-color-solid-warning-base);
    border-color: var(--sanvi-color-solid-warning-base);
  }

  .sanvi-timeline__marker--info {
    background: var(--sanvi-color-solid-primary-base);
    border-color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-timeline__line {
    flex: 1;
    width: var(--sanvi-border-width-thin);
    background: var(--sanvi-color-border-default);
    margin-block: var(--sanvi-spacing-1);
  }

  .sanvi-timeline__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    padding-block-end: var(--sanvi-spacing-4);
  }

  .sanvi-timeline__title {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-timeline__time {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-timeline__amount {
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-timeline__detail {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-timeline__actor {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    font-style: italic;
  }
</style>
