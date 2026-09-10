<script lang="ts">
import { can } from '@sanvi/auth'
import {
  ApiError,
  getAdMetrics,
  getAdMetricsExport,
  getAdMetricsFreshness,
  getAdMetricsSummary,
  listAdCampaigns,
  listAdConnections,
  listAdPlatforms,
} from '@sanvi/api-client'
import type {
  ConnectionFreshnessView,
  ConnectionView,
  MetricPoint,
  MetricsSummaryRow,
  PlatformView,
} from '@sanvi/api-client'
import { currentLocale, fmt, t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  AttributionExplainer,
  Badge,
  Button,
  Cluster,
  Container,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  HealthBanner,
  Input,
  NO_VALUE,
  OverlayChart,
  Select,
  Sparkline,
  Spinner,
  Stack,
  StatCard,
  StackedBarChart,
  UpgradePrompt,
  formatAdCurrency,
  formatRatio,
  minorUnitDigits,
  type AdHealthFigure,
  type AttributionPlatformRow,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  campaignRows,
  chartGroups,
  distinctTimezones,
  fractionChange,
  freshnessState,
  kpiGroups,
  previousRange,
  RANGE_PRESETS,
  rangeForPreset,
  type CampaignMetricRow,
  type CurrencyChartGroup,
  type DateRange,
  type RangePreset,
} from '../../lib/advertising/metrics'
import { platformNames as platformNameMap } from '../../lib/advertising/campaigns'

/**
 * The ROAS dashboard (phase 10, TASK-016 / slice 10.7) — the screen the
 * phase exists for: *is this advertising making me money?*
 *
 * Three rules shape every pixel, and each has a structural home here:
 *
 * 1. **Two numbers, both labelled, never merged.** Every place a revenue
 *    or ROAS figure renders — KPI tiles, charts, the breakdown table —
 *    shows the platform-reported figure and the Sanvi-observed figure
 *    side by side with their own labels, and each ROAS surface carries a
 *    one-click route to the attribution explainer.
 * 2. **A number that will change is never rendered as settled.** Days
 *    inside the platform's restatement window carry the ◆ marker and the
 *    "still updating" text, in the charts and in the tables; the note
 *    explains the window.
 * 3. **Timezone and currency are stated, never assumed.** KPI strips,
 *    charts, and breakdown tables are grouped *per currency* — there is
 *    no cross-currency total anywhere — and the range control states the
 *    ad accounts' timezones rather than reconciling them.
 *
 * The "sync failed" state renders from `freshness` (the backend's stalled
 * flag), never from a clock-based guess, and an over-long range renders
 * the API's own problem message instead of a spinner.
 */

type BreakdownRow = CampaignMetricRow & { [key: string]: unknown }

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let rangeError = $state<string | undefined>(undefined)
let dashboardEnabled = $state(true)

let connections = $state<ConnectionView[]>([])
let platforms = $state<PlatformView[]>([])
let campaigns = $state<{ id: string; name: string }[]>([])
let freshness = $state<ConnectionFreshnessView[]>([])

let summaryCurrent = $state<MetricsSummaryRow[]>([])
let summaryCompared = $state<MetricsSummaryRow[] | undefined>(undefined)
let metricRows = $state<MetricPoint[]>([])
let hasMetrics = $state(false)

let preset = $state<RangePreset | 'custom'>('30d')
let customFrom = $state('')
let customTo = $state('')
let activeRange = $state<DateRange>(rangeForPreset('30d'))

let exporting = $state(false)
let exportError = $state<string | undefined>(undefined)
let explainerOpen = $state(false)

let sortKey = $state<string | undefined>(undefined)
let sortDirection = $state<'asc' | 'desc'>('asc')

let loadSeq = 0

const hasActiveConnection = $derived(
  connections.some((connection) => connection.status !== 'disconnected'),
)

const names = $derived(platformNameMap(platforms))

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  rangeError = undefined
  entitled = true
  dashboardEnabled = hasFeature('advertising.dashboard')

  if (!dashboardEnabled) {
    loading = false
    return
  }

  const [connectionsResult, platformsResult, campaignsResult, freshnessResult] =
    await Promise.allSettled([
      listAdConnections(apiClient),
      listAdPlatforms(apiClient),
      listAdCampaigns(apiClient),
      getAdMetricsFreshness(apiClient),
    ])
  if (seq !== loadSeq) return

  connections =
    connectionsResult.status === 'fulfilled' ? (connectionsResult.value?.connections ?? []) : []
  platforms = platformsResult.status === 'fulfilled' ? (platformsResult.value?.platforms ?? []) : []
  campaigns =
    campaignsResult.status === 'fulfilled'
      ? (campaignsResult.value?.campaigns ?? []).map((view) => ({
          id: view.id,
          name: view.campaign.name,
        }))
      : []
  freshness =
    freshnessResult.status === 'fulfilled' ? (freshnessResult.value?.connections ?? []) : []

  if (connectionsResult.status === 'rejected') {
    const err = connectionsResult.reason
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.dashboard.loadError']()
    }
  }

  await loadMetrics(seq)
  if (seq !== loadSeq) return
  loading = false
}

/** Metrics only — applying a new range refetches these, not the connections. */
async function loadMetrics(seq: number): Promise<void> {
  rangeError = undefined
  const compareFrom = previousRange(activeRange)
  const [summaryResult, rowsResult] = await Promise.allSettled([
    getAdMetricsSummary(apiClient, {
      from: activeRange.from,
      to: activeRange.to,
      compareTo: compareFrom.from,
    }),
    getAdMetrics(apiClient, { from: activeRange.from, to: activeRange.to, groupBy: 'campaign' }),
  ])
  if (seq !== loadSeq) return

  if (summaryResult.status === 'rejected' || rowsResult.status === 'rejected') {
    summaryCurrent = []
    summaryCompared = undefined
    metricRows = []
    hasMetrics = false
    let failure: unknown
    if (summaryResult.status === 'rejected') failure = summaryResult.reason
    else if (rowsResult.status === 'rejected') failure = rowsResult.reason
    if (failure instanceof ApiError && failure.status === 403) {
      entitled = false
    } else if (failure instanceof ApiError && failure.status === 400) {
      // The API's own message for an invalid or over-long range — shown,
      // never papered over with a spinner.
      rangeError = failure.detail ?? t['admin.advertising.dashboard.errors.rangeTooLong']()
    } else {
      error = t['admin.advertising.dashboard.loadError']()
    }
    return
  }

  summaryCurrent = summaryResult.value?.current ?? []
  summaryCompared = summaryResult.value?.compared ?? undefined
  metricRows = rowsResult.value?.rows ?? []
  hasMetrics = true
}

function applyPreset(value: string): void {
  if (value === 'custom') {
    preset = 'custom'
    customFrom = customFrom || activeRange.from
    customTo = customTo || activeRange.to
    return
  }
  preset = value as RangePreset
  customFrom = ''
  customTo = ''
  void applyRange(rangeForPreset(value as RangePreset))
}

async function applyCustomRange(): Promise<void> {
  if (!customFrom || !customTo) return
  await applyRange({ from: customFrom, to: customTo })
}

async function applyRange(range: DateRange): Promise<void> {
  activeRange = range
  await loadMetrics(loadSeq)
}

async function exportCsv(): Promise<void> {
  if (exporting) return
  exporting = true
  exportError = undefined
  try {
    const csv = await getAdMetricsExport(apiClient, {
      from: activeRange.from,
      to: activeRange.to,
      groupBy: 'campaign',
    })
    download(csv, `sanvi-ads-${activeRange.from}-to-${activeRange.to}.csv`)
  } catch (err) {
    exportError =
      err instanceof ApiError && err.status === 403
        ? t['admin.advertising.dashboard.errors.forbidden']()
        : t['admin.advertising.dashboard.export.error']()
  } finally {
    exporting = false
  }
}

function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function retry(): void {
  void load()
}

$effect(() => {
  void getActiveTenantId()
  void load()
})

// --- Derived views ----------------------------------------------------------

const kpi = $derived(kpiGroups(summaryCurrent, summaryCompared))
const charts = $derived(chartGroups(metricRows))
const breakdown = $derived(campaignRows(metricRows))
const freshnessView = $derived(freshnessState(freshness))
const timezones = $derived(distinctTimezones(connections))
const canExport = $derived(can('advertising.metrics.read', getActiveTenantId()))

const timezoneStatement = $derived.by(() => {
  if (timezones.length === 0) return undefined
  if (timezones.length === 1) {
    return t['admin.advertising.dashboard.timezoneAllSame']({ timezone: timezones[0]! })
  }
  return t['admin.advertising.dashboard.timezoneMixed']({ list: fmt.list(timezones) })
})

const rangeText = $derived(
  `${fmt.date(activeRange.from, 'medium')} — ${fmt.date(activeRange.to, 'medium')}`,
)

function chartFor(currency: string): CurrencyChartGroup | undefined {
  return charts.find((entry) => entry.currency === currency)
}

function majorFormatter(currency: string): (value: number) => string {
  const locale = currentLocale()
  return (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
}

/** Exact money for data-table cells — ticks may compact, cells may not.
     Chart values are in major units; money formatting wants minor back. */
function exactFormatter(currency: string): (value: number) => string {
  const digits = minorUnitDigits(currency)
  return (value: number) => formatAdCurrency(Math.round(value * 10 ** digits), currency)
}

function campaignName(id: string): string {
  return campaigns.find((campaign) => campaign.id === id)?.name ?? id
}

function percentDelta(fraction: number | null): string {
  if (fraction === null) return t['admin.advertising.dashboard.kpi.vsPreviousNew']()
  return t['admin.advertising.dashboard.kpi.vsPrevious']({
    delta: fmt.number(fraction, {
      style: 'percent',
      signDisplay: 'always',
      maximumFractionDigits: 1,
    }),
  })
}

const breakdownByCurrency = $derived.by(() => {
  const groups = new Map<string, CampaignMetricRow[]>()
  for (const row of breakdown) {
    const bucket = groups.get(row.currency) ?? []
    bucket.push(row)
    groups.set(row.currency, bucket)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const sortedBreakdown = $derived.by(() => {
  if (!sortKey) return breakdownByCurrency
  const factor = sortDirection === 'asc' ? 1 : -1
  const key = sortKey
  return breakdownByCurrency.map(([currency, currencyRows]) => {
    const sorted = [...currencyRows].sort((left, right) => {
      if (key === 'name') {
        return campaignName(left.campaignId).localeCompare(campaignName(right.campaignId)) * factor
      }
      return (sortValue(left, key) - sortValue(right, key)) * factor
    })
    return [currency, sorted] as [string, CampaignMetricRow[]]
  })
})

function sortValue(row: CampaignMetricRow, key: string): number {
  switch (key) {
    case 'spend':
      return row.spendMinor
    case 'clicks':
      return row.clicks
    case 'impressions':
      return row.impressions
    case 'conversions':
      return row.conversions
    case 'platformValue':
      return row.platformValueMinor
    case 'sanviRevenue':
      return row.sanviRevenueMinor
    case 'roasPlatform':
      return row.roasPlatform ?? -1
    case 'roasSanvi':
      return row.roasSanvi ?? -1
    default:
      return 0
  }
}

function onBreakdownSort(key: string, direction: 'asc' | 'desc'): void {
  sortKey = key
  sortDirection = direction
}

const anyRestating = $derived(breakdown.some((row) => row.restating))
const anySpend = $derived(charts.some((group) => group.hasSpend))

const stalledFigures = $derived.by(() => {
  const figures: AdHealthFigure[] = freshnessView.stalled.map((connection) => ({
    key: connection.connection_id,
    value: t['admin.advertising.dashboard.freshness.itemStalled']({
      platform: names[connection.platform] ?? connection.platform,
      time: connection.last_ingested_at ? fmt.datetime(connection.last_ingested_at) : '—',
    }),
    label: names[connection.platform] ?? connection.platform,
    description: t['admin.advertising.dashboard.freshness.stalledDescription'](),
  }))
  return figures
})

const freshnessLine = $derived.by(() => {
  if (freshnessView.anyStalled) return undefined
  if (freshnessView.pending.length > 0) {
    return t['admin.advertising.dashboard.freshness.syncInProgress']()
  }
  const latest = freshnessView.current
    .map((connection) => connection.last_ingested_at)
    .filter((value): value is string => value !== null && value !== undefined)
    .sort()
    .at(-1)
  return latest
    ? t['admin.advertising.dashboard.freshness.lastUpdated']({ time: fmt.datetime(latest) })
    : undefined
})

const explainerRows = $derived.by(() => {
  const seen = new Set<string>()
  const rows: AttributionPlatformRow[] = []
  for (const connection of connections) {
    if (connection.status === 'disconnected' || seen.has(connection.platform)) continue
    seen.add(connection.platform)
    const platform = names[connection.platform] ?? connection.platform
    rows.push({
      key: connection.platform,
      platform,
      attribution: t['admin.advertising.dashboard.attribution.platformRow']({ platform }),
    })
  }
  return rows
})
</script>

<svelte:head>
  <title>{t['admin.advertising.dashboard.title']()}</title>
</svelte:head>

{#snippet roasInfo()}
  <button
    class="sanvi-ad-dashboard__info"
    onclick={() => (explainerOpen = true)}
    aria-label={t['admin.advertising.dashboard.attribution.openLabel']()}
  >
    ⓘ
  </button>
{/snippet}

{#snippet restatingCell()}
  <Badge variant="warning">{t['admin.advertising.dashboard.chart.restatingFlag']()}</Badge>
{/snippet}

{#snippet breakdownNameCell(row: BreakdownRow)}
  <button
    class="sanvi-ad-dashboard__campaign-link"
    onclick={() => navigate(`/advertising/campaigns/${row.campaignId}`)}
  >
    {campaignName(row.campaignId)}
  </button>
{/snippet}

<!-- Money cells carry the currency and locale rules; ratio cells carry the
     one-click explainer so every ROAS figure reaches the methodology. -->
{#snippet roasPlatformCell(row: BreakdownRow)}
  <span class="sanvi-ad-dashboard__roas">
    {formatRatio(row.roasPlatform, 1)}
    <button
      class="sanvi-ad-dashboard__info"
      onclick={() => (explainerOpen = true)}
      aria-label={t['admin.advertising.dashboard.attribution.openLabel']()}
    >
      ⓘ
    </button>
  </span>
{/snippet}

{#snippet roasSanviCell(row: BreakdownRow)}
  <span class="sanvi-ad-dashboard__roas">
    {formatRatio(row.roasSanvi, 1)}
    <button
      class="sanvi-ad-dashboard__info"
      onclick={() => (explainerOpen = true)}
      aria-label={t['admin.advertising.dashboard.attribution.openLabel']()}
    >
      ⓘ
    </button>
  </span>
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.dashboard.title']()}</h1>
      <p>{t['admin.advertising.dashboard.description']()}</p>
    </div>

    {#if loading}
      <Spinner label={t['admin.advertising.dashboard.loading']()} />
    {:else if !dashboardEnabled}
      <EmptyState
        title={t['admin.advertising.dashboard.flagOffTitle']()}
        description={t['admin.advertising.dashboard.flagOffDescription']()}
      />
    {:else if !entitled}
      <UpgradePrompt title={t['admin.advertising.upgradeTitle']()} />
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
    {:else}
      {#if error}
        <Alert variant="error">
          {error}
          <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
        </Alert>
      {/if}

      {#if rangeError}
        <Alert variant="warning">{rangeError}</Alert>
      {/if}

      <Stack gap="2">
        <div class="sanvi-ad-dashboard__range">
          <Field label={t['admin.advertising.dashboard.rangeLabel']()}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                bind:value={preset}
                onchange={(event) => applyPreset(event.currentTarget.value)}
                options={[
                  { value: '7d', label: t['admin.advertising.dashboard.preset7']() },
                  { value: '14d', label: t['admin.advertising.dashboard.preset14']() },
                  { value: '30d', label: t['admin.advertising.dashboard.preset30']() },
                  { value: 'custom', label: t['admin.advertising.dashboard.custom']() },
                ]}
              />
            {/snippet}
          </Field>
          {#if preset === 'custom'}
            <Field label={t['admin.advertising.dashboard.fromLabel']()}>
              {#snippet children(controlProps)}
                <Input {...controlProps} type="date" bind:value={customFrom} />
              {/snippet}
            </Field>
            <Field label={t['admin.advertising.dashboard.toLabel']()}>
              {#snippet children(controlProps)}
                <Input {...controlProps} type="date" bind:value={customTo} />
              {/snippet}
            </Field>
            <Button variant="secondary" onclick={() => void applyCustomRange()}>
              {t['admin.advertising.dashboard.applyCta']()}
            </Button>
          {/if}
        </div>
        <p class="sanvi-ad-dashboard__meta">
          {rangeText}{timezoneStatement ? ` — ${timezoneStatement}` : ''}
        </p>
        {#if kpi.length > 1}
          <p class="sanvi-ad-dashboard__meta">
            {t['admin.advertising.dashboard.currenciesMixed']()}
          </p>
        {/if}
        {#if freshnessLine}
          <p class="sanvi-ad-dashboard__meta">{freshnessLine}</p>
        {/if}
      </Stack>

      {#if stalledFigures.length > 0}
        <HealthBanner
          title={t['admin.advertising.dashboard.freshness.stalledTitle']()}
          figures={stalledFigures}
          tone="error"
        />
      {/if}

      {#if freshnessView.pending.length > 0 && freshnessView.current.length > 0}
        <Alert variant="info">
          {t['admin.advertising.dashboard.freshness.partialNote']()}
        </Alert>
      {/if}

      {#if !anySpend && hasMetrics && breakdown.length === 0}
        <EmptyState
          title={t['admin.advertising.dashboard.noSpend.title']()}
          description={t['admin.advertising.dashboard.noSpend.description']()}
        />
      {:else}
        {#if canExport}
          <Cluster justify="end">
            <Button variant="secondary" loading={exporting} onclick={() => void exportCsv()}>
              {t['admin.advertising.dashboard.export.cta']()}
            </Button>
          </Cluster>
        {/if}
        {#if exportError}
          <Alert variant="error">{exportError}</Alert>
        {/if}

        <!-- KPI strips: one per currency, never summed across currencies. -->
        {#each kpi as group (group.currency)}
          <section>
            <h2 class="sanvi-ad-dashboard__currency-heading">
              {t['admin.advertising.dashboard.kpi.spend']()} — {group.currency}
            </h2>
            <div class="sanvi-ad-dashboard__kpis">
              <StatCard
                label={t['admin.advertising.dashboard.kpi.spend']()}
                value={formatAdCurrency(group.current.spendMinor, group.currency)}
                description={group.previous
                  ? percentDelta(
                      fractionChange(group.current.spendMinor, group.previous.spendMinor),
                    )
                  : undefined}
              >
                {#snippet trend()}
                  {#if chartFor(group.currency)}
                    <Sparkline
                      values={chartFor(group.currency)!.spend}
                      label={t['admin.advertising.dashboard.kpi.spendSparkline']()}
                      color="var(--sanvi-color-chart-spend)"
                    />
                  {/if}
                {/snippet}
              </StatCard>

              <StatCard
                label={t['admin.advertising.dashboard.kpi.conversions']()}
                value={fmt.number(group.current.conversions, { maximumFractionDigits: 0 })}
              />

              <StatCard
                label={t['admin.advertising.dashboard.kpi.cpa']()}
                value={
                  group.current.conversions > 0
                    ? formatAdCurrency(
                        group.current.spendMinor / group.current.conversions,
                        group.currency,
                      )
                    : NO_VALUE
                }
              />

              <StatCard
                label={t['admin.advertising.dashboard.kpi.platformValue']()}
                value={formatAdCurrency(group.current.platformValueMinor, group.currency)}
              />

              <StatCard
                label={t['admin.advertising.dashboard.kpi.sanviRevenue']()}
                value={formatAdCurrency(group.current.sanviRevenueMinor, group.currency)}
                description={group.previous
                  ? percentDelta(
                      fractionChange(
                        group.current.sanviRevenueMinor,
                        group.previous.sanviRevenueMinor,
                      ),
                    )
                  : undefined}
              >
                {#snippet trend()}
                  {#if chartFor(group.currency)}
                    <Sparkline
                      values={chartFor(group.currency)!.sanviRevenue}
                      label={t['admin.advertising.dashboard.kpi.revenueSparkline']()}
                      color="var(--sanvi-color-chart-revenue)"
                    />
                  {/if}
                {/snippet}
              </StatCard>

              <StatCard
                label={t['admin.advertising.dashboard.kpi.roasPlatform']()}
                value={formatRatio(group.current.roasPlatform, 1)}
              >
                {#snippet trend()}
                  {@render roasInfo()}
                {/snippet}
              </StatCard>

              <StatCard
                label={t['admin.advertising.dashboard.kpi.roasSanvi']()}
                value={formatRatio(group.current.roasSanvi, 1)}
              >
                {#snippet trend()}
                  {@render roasInfo()}
                {/snippet}
              </StatCard>
            </div>
          </section>
        {/each}

        <!-- Charts: one spend-vs-revenue overlay + one platform stack per currency. -->
        {#each charts as chart (chart.currency)}
          {@const major = majorFormatter(chart.currency)}
          {@const dateLabels = chart.dates.map((date) => fmt.date(`${date}T00:00:00`, 'short'))}
          {@const flags = chart.restating.map((restating) =>
            restating ? t['admin.advertising.dashboard.chart.restatingFlag']() : null,
          )}
          <section class="sanvi-ad-dashboard__chart">
            <h2>
              {t['admin.advertising.dashboard.chart.overlayTitle']()}
              —
              {chart.currency}
            </h2>
            <OverlayChart
              categories={dateLabels}
              barSeries={{
                key: 'spend',
                label: t['admin.advertising.dashboard.chart.series.spend'](),
                color: 'var(--sanvi-color-chart-spend)',
                values: chart.spend,
              }}
              lineSeries={[
                {
                  key: 'platformValue',
                  label: t['admin.advertising.dashboard.chart.series.platformValue'](),
                  color: 'var(--sanvi-color-chart-series-4)',
                  values: chart.platformValue,
                },
                {
                  key: 'sanviRevenue',
                  label: t['admin.advertising.dashboard.chart.series.sanviRevenue'](),
                  color: 'var(--sanvi-color-chart-revenue)',
                  values: chart.sanviRevenue,
                },
              ]}
              yFormat={major}
              valueFormat={exactFormatter(chart.currency)}
              labels={{
                dataTable: t['admin.advertising.dashboard.chart.dataTable'](),
                caption: t['admin.advertising.dashboard.chart.overlayCaption'](),
                categoryHeader: t['admin.advertising.dashboard.chart.dateHeader'](),
                flagHeader: anyRestating
                  ? t['admin.advertising.dashboard.breakdown.restatingColumn']()
                  : undefined,
                empty: t['admin.advertising.dashboard.chart.empty'](),
                summary: t['admin.advertising.dashboard.chart.summaryOverlay'](),
              }}
              {flags}
            />
          </section>

          <section class="sanvi-ad-dashboard__chart">
            <h2>
              {t['admin.advertising.dashboard.chart.platformTitle']()}
              —
              {chart.currency}
            </h2>
            <StackedBarChart
              categories={dateLabels}
              series={chart.platformSpend.map((series, index) => ({
                key: series.key,
                label: names[series.key] ?? series.key,
                color: `var(--sanvi-color-chart-series-${(index % 4) + 1})`,
                values: series.values,
              }))}
              yFormat={major}
              valueFormat={exactFormatter(chart.currency)}
              labels={{
                dataTable: t['admin.advertising.dashboard.chart.dataTable'](),
                caption: t['admin.advertising.dashboard.chart.platformCaption'](),
                categoryHeader: t['admin.advertising.dashboard.chart.dateHeader'](),
                flagHeader: anyRestating
                  ? t['admin.advertising.dashboard.breakdown.restatingColumn']()
                  : undefined,
                empty: t['admin.advertising.dashboard.chart.empty'](),
                summary: t['admin.advertising.dashboard.chart.summaryPlatform'](),
              }}
              {flags}
            />
          </section>
        {/each}

        {#if anyRestating}
          <p class="sanvi-ad-dashboard__meta">
            {t['admin.advertising.dashboard.chart.restatingNote']()}
          </p>
        {/if}

        <!-- Breakdown: one table per currency, sortable within a currency. -->
        <section>
          <h2>{t['admin.advertising.dashboard.breakdown.title']()}</h2>
          {#each sortedBreakdown as [currency, rows] (currency)}
            {#snippet spendCell(row: BreakdownRow)}
              {formatAdCurrency(row.spendMinor, currency)}
            {/snippet}
            {#snippet impressionsCell(row: BreakdownRow)}
              {fmt.number(row.impressions)}
            {/snippet}
            {#snippet clicksCell(row: BreakdownRow)}
              {fmt.number(row.clicks)}
            {/snippet}
            {#snippet conversionsCell(row: BreakdownRow)}
              {fmt.number(row.conversions, { maximumFractionDigits: 1 })}
            {/snippet}
            {#snippet platformValueCell(row: BreakdownRow)}
              {formatAdCurrency(row.platformValueMinor, currency)}
            {/snippet}
            {#snippet sanviRevenueCell(row: BreakdownRow)}
              {formatAdCurrency(row.sanviRevenueMinor, currency)}
            {/snippet}
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: t['admin.advertising.dashboard.breakdown.campaignColumn'](),
                  cell: breakdownNameCell,
                  sortable: true,
                  alwaysVisible: true,
                },
                {
                  key: 'platform',
                  header: t['admin.advertising.dashboard.breakdown.platformColumn'](),
                },
                {
                  key: 'spend',
                  header: t['admin.advertising.dashboard.breakdown.spendColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: spendCell,
                },
                {
                  key: 'impressions',
                  header: t['admin.advertising.dashboard.breakdown.impressionsColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: impressionsCell,
                },
                {
                  key: 'clicks',
                  header: t['admin.advertising.dashboard.breakdown.clicksColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: clicksCell,
                },
                {
                  key: 'conversions',
                  header: t['admin.advertising.dashboard.breakdown.conversionsColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: conversionsCell,
                },
                {
                  key: 'platformValue',
                  header: t['admin.advertising.dashboard.breakdown.platformValueColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: platformValueCell,
                },
                {
                  key: 'sanviRevenue',
                  header: t['admin.advertising.dashboard.breakdown.sanviRevenueColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: sanviRevenueCell,
                },
                {
                  key: 'roasPlatform',
                  header: t['admin.advertising.dashboard.breakdown.roasPlatformColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: roasPlatformCell,
                },
                {
                  key: 'roasSanvi',
                  header: t['admin.advertising.dashboard.breakdown.roasSanviColumn'](),
                  align: 'end',
                  sortable: true,
                  cell: roasSanviCell,
                },
                {
                  key: 'restating',
                  header: t['admin.advertising.dashboard.breakdown.restatingColumn'](),
                  cell: restatingCell,
                },
              ]}
              rows={rows as BreakdownRow[]}
              getRowId={(row) => row.campaignId}
              caption={`${t['admin.advertising.dashboard.breakdown.caption']()} — ${currency}`}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={onBreakdownSort}
            />
          {/each}
        </section>
      {/if}
    {/if}
  </Stack>
</Container>

<Dialog
  bind:open={explainerOpen}
  titleText={t['admin.advertising.dashboard.attribution.openLabel']()}
>
  {#snippet children()}
    <AttributionExplainer
      title={t['admin.advertising.dashboard.attribution.title']()}
      intro={[
        t['admin.advertising.dashboard.attribution.intro1'](),
        t['admin.advertising.dashboard.attribution.intro2'](),
      ]}
      platformHeading={t['admin.advertising.dashboard.attribution.platformHeading']()}
      sanviHeading={t['admin.advertising.dashboard.attribution.sanviHeading']()}
      platformRows={explainerRows}
      sanviDescription={t['admin.advertising.dashboard.attribution.sanviDescription']()}
      whyDifferent={t['admin.advertising.dashboard.attribution.whyDifferent']()}
      restatement={t['admin.advertising.dashboard.attribution.restatement']()}
    />
  {/snippet}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (explainerOpen = false)}>
      {t['admin.advertising.dashboard.attribution.closeCta']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-dashboard__range {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-ad-dashboard__meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-dashboard__currency-heading {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-dashboard__kpis {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-48), 1fr));
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-ad-dashboard__chart {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-dashboard__chart h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-ad-dashboard__campaign-link {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
    cursor: pointer;
    text-align: start;
  }

  .sanvi-ad-dashboard__campaign-link:hover {
    text-decoration: underline;
  }

  .sanvi-ad-dashboard__info {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: var(--sanvi-color-text-secondary);
    cursor: pointer;
  }

  .sanvi-ad-dashboard__info:hover {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-dashboard__roas {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
    font-variant-numeric: tabular-nums;
  }
</style>
