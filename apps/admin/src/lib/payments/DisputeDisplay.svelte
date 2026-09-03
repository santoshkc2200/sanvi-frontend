<script lang="ts">
import type { DisputeView } from '@sanvi/api-client'
import { formatMinor } from '@sanvi/billing-elements'
import { fmt, t } from '@sanvi/i18n'
import { Alert, Badge, Button, Cluster, Stack } from '@sanvi/ui'

interface Props {
  disputes: DisputeView[]
}

let { disputes }: Props = $props()

function getDisputeStatusVariant(
  status: string,
): 'warning' | 'info' | 'success' | 'error' | 'neutral' {
  switch (status) {
    case 'needs_response':
    case 'warning_needs_response':
      return 'warning'
    case 'under_review':
    case 'warning_under_review':
      return 'info'
    case 'won':
      return 'success'
    case 'lost':
      return 'error'
    default:
      return 'neutral'
  }
}

function getDisputeStatusLabel(status: string): string {
  switch (status) {
    case 'needs_response':
    case 'warning_needs_response':
      return t['admin.payments.dispute.statusNeedsResponse']()
    case 'under_review':
    case 'warning_under_review':
      return t['admin.payments.dispute.statusUnderReview']()
    case 'won':
      return t['admin.payments.dispute.statusWon']()
    case 'lost':
      return t['admin.payments.dispute.statusLost']()
    case 'closed':
      return t['admin.payments.dispute.statusClosed']()
    default:
      return status
  }
}
</script>

{#if disputes && disputes.length > 0}
  <section class="sanvi-dispute-display" aria-labelledby="sanvi-dispute-heading">
    <h2 id="sanvi-dispute-heading" class="sanvi-dispute-display__title">
      {t['admin.payments.dispute.sectionTitle']()}
    </h2>

    <Alert variant="warning">
      <div class="sanvi-dispute-display__notice">
        <strong>{t['admin.payments.dispute.noticeTitle']()}</strong>
        <p>{t['admin.payments.dispute.noticeBody']()}</p>
      </div>
    </Alert>

    <Stack gap="4">
      {#each disputes as dispute (dispute.id)}
        <div class="sanvi-dispute-card">
          <Cluster justify="space-between" align="center" gap="4">
            <Stack gap="1">
              <Cluster gap="2" align="center">
                <Badge variant={getDisputeStatusVariant(dispute.status)}>
                  {#snippet children()}
                    {getDisputeStatusLabel(dispute.status)}
                  {/snippet}
                </Badge>
                <strong class="sanvi-dispute-card__amount">
                  {formatMinor(dispute.amount_minor, dispute.currency)}
                </strong>
              </Cluster>

              {#if dispute.due_by}
                <div class="sanvi-dispute-card__deadline">
                  <span class="sanvi-dispute-card__deadline-icon" aria-hidden="true">⏳</span>
                  <span>{t['admin.payments.dispute.deadline']({ date: fmt.datetime(dispute.due_by, 'medium') })}</span>
                </div>
              {:else}
                <span class="sanvi-dispute-card__meta-subtext">
                  {t['admin.payments.dispute.noDeadline']()}
                </span>
              {/if}

              {#if dispute.reason}
                <span class="sanvi-dispute-card__reason">
                  {t['admin.payments.dispute.reasonLabel']()}: {dispute.reason}
                </span>
              {/if}

              {#if dispute.created_at}
                <span class="sanvi-dispute-card__meta-subtext">
                  {t['admin.payments.dispute.openedAtLabel']()}: {fmt.datetime(dispute.created_at, 'medium')}
                </span>
              {/if}
            </Stack>

            <div>
              <a
                href={dispute.dashboard_url || 'https://dashboard.stripe.com/disputes'}
                target="_blank"
                rel="noopener noreferrer"
                class="sanvi-dispute-card__stripe-action"
              >
                <Button variant="secondary" size="sm">
                  <span>{t['admin.payments.dispute.dashboardLink']()}</span>
                  <span aria-hidden="true">↗</span>
                </Button>
              </a>
            </div>
          </Cluster>
        </div>
      {/each}
    </Stack>
  </section>
{/if}

<style>
  .sanvi-dispute-display {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-dispute-display__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-dispute-display__notice strong {
    display: block;
    margin-block-end: var(--sanvi-spacing-1);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-dispute-display__notice p {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-dispute-card {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-dispute-card__amount {
    font-size: var(--sanvi-font-size-md);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-dispute-card__deadline {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-status-error);
  }

  .sanvi-dispute-card__deadline-icon {
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-dispute-card__reason {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-dispute-card__meta-subtext {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-dispute-card__stripe-action {
    text-decoration: none;
  }
</style>
