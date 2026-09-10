<script lang="ts">
import { can } from '@sanvi/auth'
import {
  ApiError,
  acknowledgeAdBudgetAlert,
  getAdBudgetAlerts,
  listAdCampaigns,
} from '@sanvi/api-client'
import type { AlertCondition, BudgetAlert } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Container,
  DataTable,
  EmptyState,
  NO_VALUE,
  Spinner,
  Stack,
  UpgradePrompt,
  formatAdCurrency,
  showToast,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'

/**
 * The budget-alert history (phase 10, TASK-017 / slice 10.8).
 *
 * Every entry answers three questions in its row, because those are the
 * three an operator asks after a threshold fires: *how much* (the spend
 * figure against the cap), *how fresh* (the data behind the figure — an
 * alert computed on stale ingestion reads differently from a settled one),
 * and *what happened* (the action taken — a guardrail pause vs. a
 * notification). Acknowledgement round-trips through the backend: the row
 * re-renders from the PUT-style POST response, never from an optimistic
 * local flip.
 */
let loading = $state(true)
let entitled = $state(true)
let guardrailsEnabled = $state(true)
let error = $state<string | undefined>(undefined)

let alerts = $state<BudgetAlert[]>([])
let campaigns = $state<{ id: string; name: string }[]>([])
let unacknowledgedOnly = $state(false)
let acknowledgingId = $state<string | null>(null)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  alerts = []
  campaigns = []
  guardrailsEnabled = hasFeature('advertising.budget_guardrails')

  if (!guardrailsEnabled) {
    loading = false
    return
  }

  const [alertsResult, campaignsResult] = await Promise.allSettled([
    getAdBudgetAlerts(apiClient, { unacknowledgedOnly: unacknowledgedOnly || undefined }),
    listAdCampaigns(apiClient),
  ])
  if (seq !== loadSeq) return

  if (alertsResult.status === 'rejected') {
    const err = alertsResult.reason
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.budget.alerts.loadError']()
    }
  }
  alerts = alertsResult.status === 'fulfilled' ? (alertsResult.value?.alerts ?? []) : []
  campaigns =
    campaignsResult.status === 'fulfilled'
      ? (campaignsResult.value?.campaigns ?? []).map((view) => ({
          id: view.id,
          name: view.campaign.name,
        }))
      : []
  loading = false
}

const writable = $derived(can('advertising.budget.manage', getActiveTenantId()))

function scopeLabel(alert: BudgetAlert): string {
  if (!alert.campaign_id) return t['admin.advertising.budget.scope.tenant']()
  return campaigns.find((campaign) => campaign.id === alert.campaign_id)?.name ?? alert.campaign_id
}

function conditionLabel(condition: AlertCondition): string {
  switch (condition) {
    case 'threshold80':
      return t['admin.advertising.budget.alerts.condition.threshold80']()
    case 'settled_breach':
      return t['admin.advertising.budget.alerts.condition.settledBreach']()
    case 'provisional_warning':
      return t['admin.advertising.budget.alerts.condition.provisionalWarning']()
    case 'provisional_lower_bound_breach':
      return t['admin.advertising.budget.alerts.condition.provisionalLowerBound']()
    case 'stale_data_warning':
      return t['admin.advertising.budget.alerts.condition.staleData']()
    case 'spend_anomaly':
      return t['admin.advertising.budget.alerts.condition.spendAnomaly']()
    default:
      return condition
  }
}

/** The freshness of the data behind the alert's figure — a stale alert's
    figure may still move, and the row says so. */
function freshnessLabel(alert: BudgetAlert): string {
  if (alert.data_freshness.is_stale) {
    return t['admin.advertising.budget.freshness.staleLabel']({
      detail: alert.data_freshness.last_synced_at
        ? t['admin.advertising.budget.freshness.stale']({
            time: fmt.datetime(alert.data_freshness.last_synced_at),
          })
        : t['admin.advertising.budget.freshness.staleNoTime'](),
    })
  }
  return alert.data_freshness.last_synced_at
    ? t['admin.advertising.budget.freshness.current']({
        time: fmt.datetime(alert.data_freshness.last_synced_at),
      })
    : t['admin.advertising.budget.freshness.noData']()
}

function actionLabel(alert: BudgetAlert): string {
  if (alert.auto_paused) return t['admin.advertising.budget.alerts.action.paused']()
  return t['admin.advertising.budget.alerts.action.notified']()
}

function figureLabel(alert: BudgetAlert): string {
  return `${formatAdCurrency(alert.spend.amount_minor, alert.spend.currency)} / ${formatAdCurrency(alert.cap_amount.amount_minor, alert.cap_amount.currency)}`
}

async function acknowledge(alert: BudgetAlert): Promise<void> {
  acknowledgingId = alert.id
  try {
    const updated = await acknowledgeAdBudgetAlert(apiClient, alert.id)
    if (updated) {
      alerts = alerts.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    }
    showToast({
      title: t['admin.advertising.budget.alerts.ackToast'](),
      variant: 'success',
    })
  } catch {
    showToast({
      title: t['admin.advertising.budget.alerts.ackErrorToast'](),
      variant: 'error',
    })
  } finally {
    acknowledgingId = null
  }
}

function toggleFilter(): void {
  unacknowledgedOnly = !unacknowledgedOnly
  void load()
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

{#snippet dateCell(row: BudgetAlert)}
  {fmt.datetime(row.created_at)}
{/snippet}

{#snippet scopeCell(row: BudgetAlert)}
  {scopeLabel(row)}
{/snippet}

{#snippet conditionCell(row: BudgetAlert)}
  {conditionLabel(row.condition)}
{/snippet}

{#snippet figureCell(row: BudgetAlert)}
  {figureLabel(row)}
{/snippet}

{#snippet freshnessCell(row: BudgetAlert)}
  {freshnessLabel(row)}
{/snippet}

{#snippet actionCell(row: BudgetAlert)}
  {actionLabel(row)}
{/snippet}

{#snippet statusCell(row: BudgetAlert)}
  {#if row.acknowledged_at}
    {t['admin.advertising.budget.alerts.acknowledged']({
      time: fmt.datetime(row.acknowledged_at),
    })}
  {:else}
    <Badge variant="warning">{t['admin.advertising.budget.alerts.unacknowledged']()}</Badge>
  {/if}
{/snippet}

{#snippet actionsCell(row: BudgetAlert)}
  {#if !row.acknowledged_at}
    {#if writable}
      <Button
        variant="secondary"
        size="sm"
        disabled={acknowledgingId === row.id}
        onclick={() => void acknowledge(row)}
      >
        {t['admin.advertising.budget.alerts.ackCta']()}
        <span class="sanvi-visually-hidden">: {scopeLabel(row)}</span>
      </Button>
    {:else}
      {NO_VALUE}
    {/if}
  {:else}
    {NO_VALUE}
  {/if}
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.budget.alerts.title']()}</h1>
      <p>{t['admin.advertising.budget.alerts.description']()}</p>
      <Button variant="secondary" onclick={toggleFilter}>
        {unacknowledgedOnly
          ? t['admin.advertising.budget.alerts.showAll']()
          : t['admin.advertising.budget.alerts.showUnacknowledged']()}
      </Button>
    </div>

    {#if loading}
      <Spinner label={t['admin.advertising.budget.alerts.loading']()} />
    {:else if !guardrailsEnabled}
      <EmptyState
        title={t['admin.advertising.budget.flagOffTitle']()}
        description={t['admin.advertising.budget.flagOffDescription']()}
      />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      {#if error}
        <Alert variant="error">
          {error}
          <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
        </Alert>
      {/if}

      {#if alerts.length === 0}
        <EmptyState
          title={t['admin.advertising.budget.alerts.emptyTitle']()}
          description={
            unacknowledgedOnly
              ? t['admin.advertising.budget.alerts.emptyUnacknowledgedDescription']()
              : t['admin.advertising.budget.alerts.emptyDescription']()
          }
        />
      {:else}
        <DataTable
          columns={[
            {
              key: 'created_at',
              header: t['admin.advertising.budget.alerts.columnDate'](),
              cell: dateCell,
            },
            {
              key: 'scope',
              header: t['admin.advertising.budget.alerts.columnScope'](),
              cell: scopeCell,
            },
            {
              key: 'condition',
              header: t['admin.advertising.budget.alerts.columnCondition'](),
              cell: conditionCell,
            },
            {
              key: 'figure',
              header: t['admin.advertising.budget.alerts.columnFigure'](),
              cell: figureCell,
            },
            {
              key: 'freshness',
              header: t['admin.advertising.budget.alerts.columnFreshness'](),
              cell: freshnessCell,
            },
            {
              key: 'action',
              header: t['admin.advertising.budget.alerts.columnAction'](),
              cell: actionCell,
            },
            {
              key: 'status',
              header: t['admin.advertising.budget.alerts.columnStatus'](),
              cell: statusCell,
            },
            {
              key: 'actions',
              header: t['admin.advertising.budget.alerts.columnActions'](),
              cell: actionsCell,
            },
          ]}
          rows={alerts}
          getRowId={(row) => row.id}
          caption={t['admin.advertising.budget.alerts.caption']()}
        />
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
