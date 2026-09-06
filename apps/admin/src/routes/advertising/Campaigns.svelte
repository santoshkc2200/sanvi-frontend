<script lang="ts">
import {
  ApiError,
  listAdCampaigns,
  listAdConnections,
  listAdPlatforms,
  pauseAdCampaign,
  resumeAdCampaign,
} from '@sanvi/api-client'
import type { CampaignView, ConnectionView, PlatformView } from '@sanvi/api-client'
import { Can, can } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DataTable,
  Dialog,
  EmptyState,
  NO_VALUE,
  Spinner,
  Stack,
} from '@sanvi/ui'
import type { TableColumn } from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  budgetLine,
  combinedBudgetsByCurrency,
  connectionFor,
  money,
  platformNames,
  statusLabel,
} from '../../lib/advertising/campaigns'

/**
 * The campaign list (phase 10, TASK-012) — cross-platform from day one: one
 * table, a platform badge per row, each row's budget rendered in its ad
 * account's own currency. Performance columns (spend, conversions, ROAS)
 * stand empty until the dashboard slice (TASK-016) supplies real numbers;
 * an em dash renders, never a fabricated zero.
 *
 * This is the first surface where a click spends real money, so the bulk
 * actions name what they affect — the campaign count *and* the combined
 * daily budget, per currency, never summed across currencies — resuming
 * spends again and says so, and drift is a link into the diff view, never
 * something this list resolves.
 */

type CampaignRow = CampaignView & { [key: string]: unknown }

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let platforms = $state<PlatformView[]>([])
let connections = $state<ConnectionView[]>([])
let campaigns = $state<CampaignView[]>([])

let selectedIds = $state<string[]>([])

// Bulk pause/resume confirmation state.
let bulkOpen = $state(false)
let bulkAction = $state<'pause' | 'resume'>('pause')
let bulkTargets = $state<CampaignView[]>([])
let bulkBudgetLines = $state<{ currency: string; amountMinor: number }[]>([])
let bulkRunning = $state(false)
let bulkError = $state<string | undefined>(undefined)

// Single-row resume spends money again — it confirms like a spend action.
let resumeOpen = $state(false)
let resumeTarget = $state<CampaignView | null>(null)
let resumeRunning = $state(false)
let resumeError = $state<string | undefined>(undefined)

// Per-row action in flight.
let rowBusyId = $state<string | undefined>(undefined)
let rowError = $state<string | undefined>(undefined)

let loadSeq = 0

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))
const names = $derived(platformNames(platforms))
const hasActiveConnection = $derived(
  connections.some((connection) => connection.status !== 'disconnected'),
)

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  selectedIds = []
  rowError = undefined

  try {
    const catalog = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = catalog?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
    loading = false
    return
  }

  // The two lists load together and a failed half is retriable without
  // discarding the other — the table renders whatever arrived.
  const [connectionsResult, campaignsResult] = await Promise.allSettled([
    listAdConnections(apiClient),
    listAdCampaigns(apiClient),
  ])
  if (seq !== loadSeq) return
  connections =
    connectionsResult.status === 'fulfilled' ? (connectionsResult.value?.connections ?? []) : []
  campaigns = campaignsResult.status === 'fulfilled' ? (campaignsResult.value?.campaigns ?? []) : []
  error =
    connectionsResult.status === 'rejected' || campaignsResult.status === 'rejected'
      ? t['admin.advertising.campaigns.loadError']()
      : undefined
  loading = false
}

function retry(): void {
  void load()
}

function platformAvailable(view: CampaignView): boolean {
  const platform = platforms.find((candidate) => candidate.key === view.platform)
  return platform ? platform.available && !platform.upgrade_required : true
}

function currencyFor(view: CampaignView): string | undefined {
  return connectionFor(view, connections)?.currency
}

function statusTone(status: string): 'success' | 'neutral' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  return 'neutral'
}

function newCampaignHref(): string {
  const selectable = connections.filter((connection) => connection.status !== 'disconnected')
  return selectable.length === 1 && selectable[0]
    ? `/advertising/campaigns/new?connection=${encodeURIComponent(selectable[0].id)}`
    : '/advertising/campaigns/new'
}

/** One message per failure shape, including the 503 "keeps spending" honesty rule. */
function mutationError(
  err: unknown,
  action: 'pause' | 'resume' | 'bulk-pause' | 'bulk-resume',
): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return t['admin.advertising.campaigns.platformUnavailable']()
    if (err.status === 409) return t['admin.advertising.campaigns.notPublishable']()
    if (err.status === 403) return t['admin.advertising.campaigns.forbidden']()
    if (err.status === 429) return t['admin.advertising.campaigns.quota']()
  }
  return action === 'pause' || action === 'bulk-pause'
    ? t['admin.advertising.campaigns.pauseError']()
    : t['admin.advertising.campaigns.resumeError']()
}

// --- Row actions -----------------------------------------------------------

async function pauseRow(view: CampaignView): Promise<void> {
  if (rowBusyId) return
  rowBusyId = view.id
  rowError = undefined
  try {
    await pauseAdCampaign(apiClient, view.id, crypto.randomUUID())
    await load()
  } catch (err) {
    rowError = mutationError(err, 'pause')
  } finally {
    rowBusyId = undefined
  }
}

function openResume(view: CampaignView): void {
  resumeTarget = view
  resumeError = undefined
  resumeOpen = true
}

function resumeBudget(): string {
  if (!resumeTarget) return ''
  const currency = currencyFor(resumeTarget)
  return currency
    ? money(resumeTarget.campaign.budget.amount.amount_minor, currency)
    : resumeTarget.campaign.budget.amount.currency
}

async function confirmResume(): Promise<void> {
  const view = resumeTarget
  if (!view || resumeRunning) return
  resumeRunning = true
  try {
    await resumeAdCampaign(apiClient, view.id, crypto.randomUUID())
    resumeOpen = false
    resumeTarget = null
    await load()
  } catch (err) {
    resumeError = mutationError(err, 'resume')
  } finally {
    resumeRunning = false
  }
}

// --- Bulk actions ----------------------------------------------------------

function openBulk(
  action: 'pause' | 'resume',
  args: { selectedIds: string[]; clearSelection: () => void },
): void {
  const eligible = action === 'pause' ? 'active' : 'paused'
  const targets = campaigns.filter(
    (view) =>
      args.selectedIds.includes(view.id) &&
      platformAvailable(view) &&
      view.campaign.status === eligible,
  )
  if (targets.length === 0) {
    rowError = t['admin.advertising.campaigns.bulkNoneEligible']()
    return
  }
  rowError = undefined
  bulkAction = action
  bulkTargets = targets
  bulkBudgetLines = combinedBudgetsByCurrency(targets, currencyFor)
  bulkError = undefined
  bulkOpen = true
}

async function confirmBulk(): Promise<void> {
  if (bulkRunning || bulkTargets.length === 0) return
  bulkRunning = true
  bulkError = undefined
  const action = bulkAction
  const mutator = action === 'pause' ? pauseAdCampaign : resumeAdCampaign
  const results = await Promise.allSettled(
    bulkTargets.map((view) => mutator(apiClient, view.id, crypto.randomUUID())),
  )
  bulkRunning = false

  const succeeded: CampaignView[] = []
  const failed: CampaignView[] = []
  let firstReason: unknown
  results.forEach((result, i) => {
    const target = bulkTargets[i]
    if (target) {
      if (result.status === 'fulfilled') {
        succeeded.push(target)
      } else {
        failed.push(target)
        if (firstReason === undefined) firstReason = result.reason
      }
    }
  })

  await load()

  if (failed.length === 0) {
    bulkOpen = false
    bulkTargets = []
    selectedIds = []
  } else {
    bulkTargets = failed
    bulkBudgetLines = combinedBudgetsByCurrency(failed, currencyFor)
    selectedIds = failed.map((view) => view.id)
    // Counts alone hide the reason; the shape-specific message carries the
    // 503 "keeps spending" honesty rule, quota and permission cases.
    bulkError = `${t['admin.advertising.campaigns.bulkPartialFailure']({
      succeeded: succeeded.length,
      failed: failed.length,
    })} ${mutationError(firstReason, action === 'pause' ? 'bulk-pause' : 'bulk-resume')}`
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<svelte:head>
  <title>{t['admin.advertising.campaigns.title']()}</title>
</svelte:head>

{#snippet statusCell(row: CampaignRow)}
  <Badge variant={statusTone(row.campaign.status)}>{statusLabel(row.campaign.status)}</Badge>
{/snippet}

{#snippet platformCell(row: CampaignRow)}
  {names[row.platform] ?? row.platform}
{/snippet}

{#snippet nameCell(row: CampaignRow)}
  <button
    class="sanvi-ad-campaigns__name-link"
    onclick={() => navigate(`/advertising/campaigns/${row.id}`)}
  >
    {row.campaign.name}
  </button>
{/snippet}

{#snippet budgetCell(row: CampaignRow)}
  {@const currency = currencyFor(row)}
  {currency ? budgetLine(row.campaign, currency) : NO_VALUE}
{/snippet}

{#snippet pendingMetricCell()}
  {NO_VALUE}
{/snippet}

{#snippet driftCell(row: CampaignRow)}
  {#if row.campaign.drift.drifted}
    <a class="sanvi-ad-campaigns__drift-link" href={`/advertising/campaigns/${row.id}/drift`}>
      {t['admin.advertising.campaigns.driftedBadge']()}
    </a>
  {/if}
{/snippet}

{#snippet actionsCell(row: CampaignRow)}
  <Cluster gap="2">
    {#if writable && platformAvailable(row)}
      {#if row.campaign.status === 'active'}
        <Button
          variant="ghost"
          size="sm"
          disabled={rowBusyId !== undefined}
          onclick={() => void pauseRow(row)}
        >
          {t['admin.advertising.campaigns.pauseAction']()}
        </Button>
      {:else if row.campaign.status === 'paused'}
        <Button variant="ghost" size="sm" disabled={rowBusyId !== undefined} onclick={() => openResume(row)}>
          {t['admin.advertising.campaigns.resumeAction']()}
        </Button>
      {/if}
    {:else if writable}
      <!-- Flag off for this platform: mutations refuse, and the disabled
           state says the campaigns keep running rather than implying pause. -->
      <span class="sanvi-ad-campaigns__platform-off">
        {t['admin.advertising.campaigns.platformOff']()}
      </span>
    {/if}
    {#if writable}
      <Button variant="ghost" size="sm" onclick={() => navigate(`/advertising/campaigns/${row.id}/edit`)}>
        {t['admin.advertising.campaigns.editAction']()}
      </Button>
    {/if}
    <Button variant="ghost" size="sm" onclick={() => navigate(`/advertising/campaigns/${row.id}`)}>
      {t['admin.advertising.campaigns.detailAction']()}
    </Button>
  </Cluster>
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.campaigns.title']()}</h1>
      <p>{t['admin.advertising.campaigns.description']()}</p>
      <Can permission="advertising.campaign.write" tenantId={getActiveTenantId()}>
        {#snippet children()}
          <Button variant="primary" onclick={() => navigate(newCampaignHref())}>
            {t['admin.advertising.campaigns.newCta']()}
          </Button>
        {/snippet}
      </Can>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
      </Alert>
    {/if}

    {#if rowError}
      <Alert variant="error">{rowError}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.campaigns.loading']()} />
    {:else if !entitled}
      <EmptyState
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
      />
    {:else if !hasActiveConnection}
      <EmptyState
        title={t['admin.advertising.campaigns.noConnectionTitle']()}
        description={t['admin.advertising.campaigns.noConnectionDescription']()}
      >
        {#snippet action()}
          <Button variant="secondary" onclick={() => navigate('/advertising/connections')}>
            {t['admin.advertising.manageConnectionsCta']()}
          </Button>
        {/snippet}
      </EmptyState>
    {:else if campaigns.length === 0}
      <EmptyState
        title={t['admin.advertising.campaigns.emptyTitle']()}
        description={t['admin.advertising.campaigns.emptyDescription']()}
      />
    {:else}
      <p class="sanvi-ad-campaigns__metrics-note">
        {t['admin.advertising.campaigns.metricsPendingNote']()}
      </p>
      <DataTable
        columns={[
          {
            key: 'name',
            header: t['admin.advertising.campaigns.nameColumn'](),
            cell: nameCell,
            alwaysVisible: true,
          },
          { key: 'platform', header: t['admin.advertising.campaigns.platformColumn'](), cell: platformCell },
          { key: 'status', header: t['admin.advertising.campaigns.statusColumn'](), cell: statusCell },
          { key: 'budget', header: t['admin.advertising.campaigns.budgetColumn'](), cell: budgetCell },
          {
            key: 'spend',
            header: t['admin.advertising.campaigns.spendColumn'](),
            align: 'end',
            cell: pendingMetricCell,
          },
          {
            key: 'conversions',
            header: t['admin.advertising.campaigns.conversionsColumn'](),
            align: 'end',
            cell: pendingMetricCell,
          },
          {
            key: 'roas',
            header: t['admin.advertising.campaigns.roasColumn'](),
            align: 'end',
            cell: pendingMetricCell,
          },
          { key: 'drift', header: t['admin.advertising.campaigns.driftColumn'](), cell: driftCell },
          {
            key: 'actions',
            header: t['admin.advertising.campaigns.actionsColumn'](),
            cell: actionsCell,
            alwaysVisible: true,
          },
        ]}
        rows={campaigns as CampaignRow[]}
        getRowId={(row) => row.id}
        caption={t['admin.advertising.campaigns.tableCaption']()}
        selectable={writable}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => {
          selectedIds = ids
        }}
        bulkSelectionLabel={(count) => t['admin.advertising.campaigns.selectedLabel']({ count })}
        selectAllLabel={t['admin.advertising.campaigns.selectAll']()}
        selectRowLabel={t['admin.advertising.campaigns.selectRow']()}
      >
        {#snippet bulkActions(args)}
          <Cluster gap="2">
            <Button variant="secondary" size="sm" onclick={() => openBulk('pause', args)}>
              {t['admin.advertising.campaigns.bulkPause']()}
            </Button>
            <Button variant="secondary" size="sm" onclick={() => openBulk('resume', args)}>
              {t['admin.advertising.campaigns.bulkResume']()}
            </Button>
          </Cluster>
        {/snippet}
      </DataTable>
    {/if}
  </Stack>
</Container>

<Dialog
  bind:open={bulkOpen}
  titleText={
    bulkAction === 'pause'
      ? t['admin.advertising.campaigns.bulkPauseTitle']()
      : t['admin.advertising.campaigns.bulkResumeTitle']()
  }
>
  {#snippet children()}
    <Stack gap="4">
      <p>
        {bulkAction === 'pause'
          ? t['admin.advertising.campaigns.bulkAffected']({ count: bulkTargets.length })
          : t['admin.advertising.campaigns.bulkResumeAffected']({ count: bulkTargets.length })}
      </p>
      {#if bulkBudgetLines.length > 0}
        <div>
          <p class="sanvi-ad-campaigns__budget-heading">
            {t['admin.advertising.campaigns.bulkBudgetHeading']()}
          </p>
          <ul class="sanvi-ad-campaigns__budget-list">
            {#each bulkBudgetLines as line (line.currency)}
              <li>{money(line.amountMinor, line.currency)}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <Alert variant="warning">
        {bulkAction === 'pause'
          ? t['admin.advertising.campaigns.bulkPauseConsequence']()
          : t['admin.advertising.campaigns.bulkResumeConsequence']()}
      </Alert>
      {#if bulkError}
        <Alert variant="error">{bulkError}</Alert>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        bulkOpen = false
      }}
      disabled={bulkRunning}
    >
      {t['common.cancel']()}
    </Button>
    <Button
      variant={bulkAction === 'pause' ? 'danger' : 'primary'}
      loading={bulkRunning}
      onclick={() => void confirmBulk()}
    >
      {bulkAction === 'pause'
        ? t['admin.advertising.campaigns.bulkPauseConfirm']()
        : t['admin.advertising.campaigns.bulkResumeConfirm']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={resumeOpen} titleText={t['admin.advertising.campaigns.resumeTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      <p>
        {t['admin.advertising.campaigns.resumeDescription']({
          name: resumeTarget?.campaign.name ?? '',
          budget: resumeBudget(),
        })}
      </p>
      {#if resumeError}
        <Alert variant="error">{resumeError}</Alert>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        resumeOpen = false
      }}
      disabled={resumeRunning}
    >
      {t['common.cancel']()}
    </Button>
    <Button variant="primary" loading={resumeRunning} onclick={() => void confirmResume()}>
      {t['admin.advertising.campaigns.resumeConfirm']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-campaigns__metrics-note {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-campaigns__budget-heading {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-campaigns__budget-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
  }

  .sanvi-ad-campaigns__name-link {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
    cursor: pointer;
    text-align: start;
  }

  .sanvi-ad-campaigns__name-link:hover {
    text-decoration: underline;
  }

  .sanvi-ad-campaigns__platform-off {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-campaigns__drift-link {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
  }
</style>
