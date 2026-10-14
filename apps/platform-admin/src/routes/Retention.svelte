<script lang="ts">
import { getRetentionReport } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { Alert, Button, EmptyState, RetentionReportView, Spinner } from '@sanvi/ui'
import { rawApiClient } from '../lib/api'

/**
 * The retention surface (TASK-028, FR-1130): every class from the backend's
 * live retention report — rule, last run, rows affected, oldest surviving
 * row — with a stalled class visibly flagged. The view component is the
 * shared `RetentionReportView`, exported from `@sanvi/ui` so TASK-029's
 * evidence surfaces reuse it rather than copy it.
 *
 * The report endpoint is a recorded cross-repo gap (see
 * `docs/release/needs-humans.md`): the backend generates the report and
 * alerts from the same ledger via the CLI, but does not yet expose it over
 * HTTP. Until it does, this page says so honestly — an empty table would
 * claim classes have no runs, which is the one lie this surface exists to
 * prevent.
 */

let loading = $state(true)
let loadError = $state<string | undefined>(undefined)
let endpointMissing = $state(false)
let loadTraceId = $state<string | undefined>(undefined)
// `undefined` while loading / on failure — the view renders only over a
// parsed report.
let report = $state<Awaited<ReturnType<typeof getRetentionReport>>>(undefined)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  loadError = undefined
  endpointMissing = false
  loadTraceId = undefined
  try {
    const parsed = await getRetentionReport(rawApiClient)
    if (seq !== loadSeq) return
    report = parsed
    if (!parsed) {
      // Reached the wire but not a valid report — same honest treatment as a
      // missing endpoint: never an empty table.
      endpointMissing = true
    }
  } catch (error) {
    if (seq !== loadSeq) return
    const status =
      error != null && typeof error === 'object' && 'status' in error
        ? (error as { status?: number }).status
        : undefined
    if (status === 404) {
      endpointMissing = true
    } else {
      loadError = t['platform.retention.loadError']()
      loadTraceId = rawApiClient.getLastTraceId()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void load()
})

const generatedAtLabel = $derived(
  report
    ? t['platform.retention.generatedAt']({
        time: new Date(report.generatedAt).toLocaleString(),
      })
    : undefined,
)
const stalenessLabel = $derived(
  report
    ? t['platform.retention.stalenessWindow']({ hours: report.stalenessWindowHours })
    : undefined,
)
</script>

<div class="sanvi-retention-page">
  <div class="sanvi-retention-page__header">
    <div>
      <h1>{t['platform.retention.title']()}</h1>
      <p>{t['platform.retention.description']()}</p>
    </div>
  </div>

  {#if loading}
    <Spinner label={t['common.loading']()} />
  {:else if loadError}
    <Alert variant="error" title={loadError}>
      <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
      {#if loadTraceId}
        <p>{t['errors.traceId']({ id: loadTraceId })}</p>
      {/if}
    </Alert>
  {:else if endpointMissing}
    <!-- The cross-repo gap, named: the report exists (the CLI generates it,
         the alert evaluates it) but this backend build does not serve it. -->
    <EmptyState
      title={t['platform.retention.missingTitle']()}
      description={t['platform.retention.missingDescription']()}
      titleTag="h2"
    />
  {:else if report}
    {#if report.classes.length === 0}
      <!-- A report with zero classes is itself a finding — the backend's
           registry cannot legitimately be empty — so it renders as the
           problem it is, never as a clean empty table. -->
      <Alert variant="warning" title={t['platform.retention.emptyTitle']()}>
        {t['platform.retention.emptyBody']()}
      </Alert>
    {:else}
      <RetentionReportView
        classes={report.classes}
        {generatedAtLabel}
        {stalenessLabel}
        classHeader={t['platform.retention.classHeader']()}
        ruleHeader={t['platform.retention.ruleHeader']()}
        lastRunHeader={t['platform.retention.lastRunHeader']()}
        oldestHeader={t['platform.retention.oldestHeader']()}
        statusHeader={t['platform.retention.statusHeader']()}
        noRunLabel={t['platform.retention.noRun']()}
        stalledLabel={t['platform.retention.stalledFlag']()}
        statusOkLabel={t['platform.retention.statusOk']()}
        stalledBannerTitle={t['platform.retention.stalledBannerTitle']({
          hours: report.stalenessWindowHours,
        })}
        stalledBannerBody={t['platform.retention.stalledBannerBody']()}
        caption={t['platform.retention.tableCaption']()}
      />
    {/if}
  {/if}
</div>

<style>
  .sanvi-retention-page__header {
    margin-block-end: var(--sanvi-spacing-4);
  }
</style>
