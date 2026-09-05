<script lang="ts">
import type { PaymentConnectionView } from '@sanvi/api-client'
import { hasMessage, t } from '@sanvi/i18n'
import { Alert, Badge } from '@sanvi/ui'

interface Props {
  connection: PaymentConnectionView
  isChecking?: boolean
  labels: {
    statusSectionTitle: string
    statusCheckingWithStripe: string
    statusActive: string
    statusOnboarding: string
    statusPending: string
    statusRestricted: string
    statusRejected: string
    statusDisconnected: string
    verdictCanAcceptPayments: string
    verdictCannotAcceptPayments: string
    verdictRestrictedTitle: string
    verdictRestrictedBody: string
    capabilitiesTitle: string
    capabilityCardPayments: string
    capabilityTransfers: string
    capabilityActive: string
    capabilityInactive: string
    capabilityPending: string
    requirementsTitle: string
    requirementsEmpty: string
    requirementsPastDueTitle: string
    requirementsCurrentlyDueTitle: string
    requirementsEventuallyDueTitle: string
    requirementsDeadline: string
    stripeHelpLink: string
    openStripeDashboard: string
  }
}

let { connection, isChecking = false, labels }: Props = $props()

function getStatusBadgeVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success'
    case 'restricted':
    case 'rejected':
      return 'error'
    case 'onboarding':
    case 'pending':
      return 'warning'
    case 'disconnected':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return labels.statusActive
    case 'restricted':
      return labels.statusRestricted
    case 'rejected':
      return labels.statusRejected
    case 'onboarding':
      return labels.statusOnboarding
    case 'pending':
      return labels.statusPending
    case 'disconnected':
      return labels.statusDisconnected
    default:
      return status
  }
}

function getCapabilityName(name: string): string {
  if (name === 'card_payments') return labels.capabilityCardPayments
  if (name === 'transfers') return labels.capabilityTransfers
  return name.replace(/_/g, ' ')
}

function getCapabilityStatusLabel(status: string): string {
  if (status === 'active') return labels.capabilityActive
  if (status === 'inactive') return labels.capabilityInactive
  if (status === 'pending') return labels.capabilityPending
  return status
}

function getCapabilityBadgeVariant(status: string): 'success' | 'neutral' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'inactive') return 'neutral'
  return 'warning'
}

const parsedCapabilities = $derived.by(() => {
  if (!connection.capabilities || typeof connection.capabilities !== 'object') {
    return []
  }
  return Object.entries(connection.capabilities as Record<string, string>).map(
    ([name, status]) => ({
      name,
      displayName: getCapabilityName(name),
      status: String(status),
      statusLabel: getCapabilityStatusLabel(String(status)),
      variant: getCapabilityBadgeVariant(String(status)),
    }),
  )
})

function renderRequirementText(item: { code: string; summary_key: string }): {
  text: string
  isUnmapped: boolean
} {
  const key = item.summary_key
  if (key && hasMessage(key)) {
    if (key === 'payments.req.unmapped') {
      return { text: t[key]({ code: item.code }), isUnmapped: true }
    }
    return { text: t[key]({ code: item.code }), isUnmapped: false }
  }
  return { text: item.code, isUnmapped: true }
}

function renderBlockerText(key: string): string {
  if (key && hasMessage(key)) {
    return t[key]()
  }
  return key
}

const hasRequirements = $derived(
  (connection.requirements.past_due?.length ?? 0) > 0 ||
    (connection.requirements.currently_due?.length ?? 0) > 0 ||
    (connection.requirements.eventually_due?.length ?? 0) > 0,
)
</script>

<section class="sanvi-payment-status" aria-labelledby="sanvi-payment-status-heading">
  <div class="sanvi-payment-status__header">
    <div class="sanvi-payment-status__title-group">
      <h2 id="sanvi-payment-status-heading" class="sanvi-payment-status__title">
        {labels.statusSectionTitle}
      </h2>
      <div class="sanvi-payment-status__badge-wrap">
        <Badge variant={getStatusBadgeVariant(connection.status)}>
          {#snippet children()}
            <span class="sanvi-payment-status__badge-content">
              {#if connection.status === 'active'}
                <span class="sanvi-payment-status__badge-icon" aria-hidden="true">✓</span>
              {:else if connection.status === 'restricted' || connection.status === 'rejected'}
                <span class="sanvi-payment-status__badge-icon" aria-hidden="true">⚠</span>
              {:else if connection.status === 'onboarding' || connection.status === 'pending'}
                <span class="sanvi-payment-status__badge-icon" aria-hidden="true">⏳</span>
              {:else}
                <span class="sanvi-payment-status__badge-icon" aria-hidden="true">○</span>
              {/if}
              <span>{getStatusLabel(connection.status)}</span>
            </span>
          {/snippet}
        </Badge>
      </div>
    </div>

    {#if isChecking}
      <div class="sanvi-payment-status__checking" role="status" aria-live="polite">
        <span class="sanvi-payment-status__spinner" aria-hidden="true"></span>
        <span>{labels.statusCheckingWithStripe}</span>
      </div>
    {/if}
  </div>

  <div class="sanvi-payment-status__verdict-banner">
    {#if connection.can_accept_payments}
      <Alert variant="success">
        {#snippet children()}
          <div class="sanvi-payment-status__verdict-row">
            <span class="sanvi-payment-status__verdict-icon" aria-hidden="true">✓</span>
            <p class="sanvi-payment-status__verdict-title">{labels.verdictCanAcceptPayments}</p>
          </div>
        {/snippet}
      </Alert>
    {:else if connection.status === 'restricted'}
      <Alert variant="error" title={labels.verdictRestrictedTitle}>
        {#snippet children()}
          <div class="sanvi-payment-status__restricted-content">
            <p class="sanvi-payment-status__restricted-desc">{labels.verdictRestrictedBody}</p>
            {#if connection.blockers && connection.blockers.length > 0}
              <ul class="sanvi-payment-status__blocker-list">
                {#each connection.blockers as blocker (blocker.summary_key)}
                  <li>{renderBlockerText(blocker.summary_key)}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/snippet}
      </Alert>
    {:else}
      <Alert variant="warning">
        {#snippet children()}
          <div class="sanvi-payment-status__verdict-block">
            <div class="sanvi-payment-status__verdict-row">
              <span class="sanvi-payment-status__verdict-icon" aria-hidden="true">⚠</span>
              <p class="sanvi-payment-status__verdict-title">{labels.verdictCannotAcceptPayments}</p>
            </div>
            {#if connection.blockers && connection.blockers.length > 0}
              <ul class="sanvi-payment-status__blocker-list">
                {#each connection.blockers as blocker (blocker.summary_key)}
                  <li>{renderBlockerText(blocker.summary_key)}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/snippet}
      </Alert>
    {/if}
  </div>

  {#if parsedCapabilities.length > 0}
    <div class="sanvi-payment-status__section">
      <h3 class="sanvi-payment-status__section-title">{labels.capabilitiesTitle}</h3>
      <ul class="sanvi-payment-status__capability-list">
        {#each parsedCapabilities as cap (cap.name)}
          <li class="sanvi-payment-status__capability-item">
            <span class="sanvi-payment-status__capability-name">{cap.displayName}</span>
            <Badge variant={cap.variant}>
              {#snippet children()}
                <span class="sanvi-payment-status__badge-content">
                  {#if cap.status === 'active'}
                    <span class="sanvi-payment-status__badge-icon" aria-hidden="true">✓</span>
                  {:else if cap.status === 'inactive'}
                    <span class="sanvi-payment-status__badge-icon" aria-hidden="true">○</span>
                  {:else}
                    <span class="sanvi-payment-status__badge-icon" aria-hidden="true">⏳</span>
                  {/if}
                  <span>{cap.statusLabel}</span>
                </span>
              {/snippet}
            </Badge>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="sanvi-payment-status__section">
    <div class="sanvi-payment-status__requirements-header">
      <h3 class="sanvi-payment-status__section-title">{labels.requirementsTitle}</h3>
      {#if connection.requirements.deadline}
        <span class="sanvi-payment-status__deadline">
          {labels.requirementsDeadline}
        </span>
      {/if}
    </div>

    {#if !hasRequirements}
      <p class="sanvi-payment-status__empty-requirements">{labels.requirementsEmpty}</p>
    {:else}
      <div class="sanvi-payment-status__requirements-groups">
        {#if (connection.requirements.past_due?.length ?? 0) > 0}
          <div class="sanvi-payment-status__req-group">
            <h4 class="sanvi-payment-status__req-group-title sanvi-payment-status__req-group-title--past-due">
              <span class="sanvi-payment-status__badge-icon" aria-hidden="true">⚠</span>
              <span>{labels.requirementsPastDueTitle}</span>
            </h4>
            <ul class="sanvi-payment-status__req-list">
              {#each connection.requirements.past_due as item (item.code)}
                {@const rendered = renderRequirementText(item)}
                <li class="sanvi-payment-status__req-item">
                  <span class="sanvi-payment-status__req-text">{rendered.text}</span>
                  {#if rendered.isUnmapped}
                    <a
                      href="https://stripe.com/docs/connect/identity-verification"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="sanvi-payment-status__help-link"
                    >
                      {labels.stripeHelpLink}
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if (connection.requirements.currently_due?.length ?? 0) > 0}
          <div class="sanvi-payment-status__req-group">
            <h4 class="sanvi-payment-status__req-group-title sanvi-payment-status__req-group-title--currently-due">
              <span class="sanvi-payment-status__badge-icon" aria-hidden="true">⏳</span>
              <span>{labels.requirementsCurrentlyDueTitle}</span>
            </h4>
            <ul class="sanvi-payment-status__req-list">
              {#each connection.requirements.currently_due as item (item.code)}
                {@const rendered = renderRequirementText(item)}
                <li class="sanvi-payment-status__req-item">
                  <span class="sanvi-payment-status__req-text">{rendered.text}</span>
                  {#if rendered.isUnmapped}
                    <a
                      href="https://stripe.com/docs/connect/identity-verification"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="sanvi-payment-status__help-link"
                    >
                      {labels.stripeHelpLink}
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if (connection.requirements.eventually_due?.length ?? 0) > 0}
          <div class="sanvi-payment-status__req-group">
            <h4 class="sanvi-payment-status__req-group-title sanvi-payment-status__req-group-title--eventually-due">
              <span class="sanvi-payment-status__badge-icon" aria-hidden="true">ℹ</span>
              <span>{labels.requirementsEventuallyDueTitle}</span>
            </h4>
            <ul class="sanvi-payment-status__req-list">
              {#each connection.requirements.eventually_due as item (item.code)}
                {@const rendered = renderRequirementText(item)}
                <li class="sanvi-payment-status__req-item">
                  <span class="sanvi-payment-status__req-text">{rendered.text}</span>
                  {#if rendered.isUnmapped}
                    <a
                      href="https://stripe.com/docs/connect/identity-verification"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="sanvi-payment-status__help-link"
                    >
                      {labels.stripeHelpLink}
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="sanvi-payment-status__actions">
    <a
      href="https://dashboard.stripe.com"
      target="_blank"
      rel="noopener noreferrer"
      class="sanvi-payment-status__dashboard-link"
    >
      <span>{labels.openStripeDashboard}</span>
      <span class="sanvi-payment-status__external-icon" aria-hidden="true">↗</span>
    </a>
  </div>
</section>

<style>
  .sanvi-payment-status {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payment-status__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payment-status__title-group {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payment-status__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-status__badge-wrap {
    display: inline-flex;
  }

  .sanvi-payment-status__badge-content {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payment-status__badge-icon {
    font-size: var(--sanvi-font-size-xs);
    line-height: var(--sanvi-line-height-tight);
  }

  .sanvi-payment-status__checking {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-status__spinner {
    width: var(--sanvi-spacing-3);
    height: var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-top-color: var(--sanvi-color-primary-base);
    border-radius: var(--sanvi-radius-full);
    animation: sanvi-spin 0.8s linear infinite;
  }

  @keyframes sanvi-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .sanvi-payment-status__verdict-banner {
    display: flex;
    flex-direction: column;
  }

  .sanvi-payment-status__verdict-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__verdict-block {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__verdict-icon {
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-payment-status__verdict-title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-payment-status__restricted-content {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__restricted-desc {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-payment-status__blocker-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-4);
    font-size: var(--sanvi-font-size-xs);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payment-status__section {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding-top: var(--sanvi-spacing-3);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-payment-status__section-title {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-status__capability-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--sanvi-spacing-32) + var(--sanvi-spacing-16)), 1fr));
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__capability-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-payment-status__capability-name {
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-status__requirements-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__deadline {
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-status-warning);
  }

  .sanvi-payment-status__empty-requirements {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-status__requirements-groups {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payment-status__req-group {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__req-group-title {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-semibold);
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payment-status__req-group-title--past-due {
    color: var(--sanvi-color-status-error);
  }

  .sanvi-payment-status__req-group-title--currently-due {
    color: var(--sanvi-color-status-warning);
  }

  .sanvi-payment-status__req-group-title--eventually-due {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-status__req-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-payment-status__req-item {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-status__help-link {
    margin-inline-start: var(--sanvi-spacing-2);
    color: var(--sanvi-color-primary-base);
    text-decoration: underline;
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-payment-status__help-link:hover {
    color: var(--sanvi-color-primary-hover);
  }

  .sanvi-payment-status__actions {
    display: flex;
    padding-top: var(--sanvi-spacing-2);
  }

  .sanvi-payment-status__dashboard-link {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
    color: var(--sanvi-color-primary-base);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    text-decoration: none;
  }

  .sanvi-payment-status__dashboard-link:hover {
    color: var(--sanvi-color-primary-hover);
    text-decoration: underline;
  }

  .sanvi-payment-status__external-icon {
    font-size: var(--sanvi-font-size-xs);
  }
</style>
