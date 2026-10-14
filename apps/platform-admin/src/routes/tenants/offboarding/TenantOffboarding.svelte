<script lang="ts">
import { getOffboarding, getTenant, purgeReportOf, requestOffboarding } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  DangerousAction,
  DetailShell,
  EmptyState,
  ErrorView,
  Field,
  Input,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../../../lib/api'

/**
 * The offboarding console (TASK-028, FR-1131): start the export-then-purge
 * request, watch the record the operator CLI advances, present the verified
 * export's evidence, and — only once the export verifies — offer the purge
 * step behind a typed confirmation naming the tenant. The purge itself runs
 * in the operator CLI (the backend has no purge endpoint by design: "the
 * purge needs a typed confirmation no HTTP call can supply"); this console
 * gates the documented command and shows the stored purge report as two
 * separated lists.
 */

interface Props {
  id: string
}

let { id }: Props = $props()

type OffboardingSnapshot = components['schemas']['OffboardingSnapshot']

let tenant = $state<components['schemas']['TenantView'] | undefined>(undefined)
let loading = $state(true)
let loadError = $state<string | undefined>(undefined)
let loadTraceId = $state<string | undefined>(undefined)

// `undefined` = not requested yet (the API's 404); `null` = answer lost.
let snapshot = $state<OffboardingSnapshot | null | undefined>(undefined)

let idempotencyKey = $state('')
let startSubmitting = $state(false)
let startError = $state<string | undefined>(undefined)

let purgeConfirmOpen = $state(false)
// The documented purge command renders only after the typed confirmation.
let purgeRevealed = $state(false)

let loadSeq = 0

const TERMINAL_STATUSES = new Set(['purged', 'failed'])
const POLL_INTERVAL_MS = 5000

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  loadError = undefined
  loadTraceId = undefined
  try {
    const [tenantResult, offboardingResult] = await Promise.allSettled([
      getTenant(apiClient, id),
      getOffboarding(apiClient, id),
    ])
    if (seq !== loadSeq) return
    if (tenantResult.status === 'rejected') {
      loadError = t['platform.offboarding.loadError']()
      loadTraceId = apiClient.getLastTraceId()
      loading = false
      return
    }
    tenant = tenantResult.value
    if (offboardingResult.status === 'rejected') {
      const failure = offboardingResult.reason
      if (
        failure != null &&
        typeof failure === 'object' &&
        'status' in failure &&
        (failure as { status?: number }).status === 404
      ) {
        snapshot = undefined
        idempotencyKey = defaultKey()
      } else {
        loadError = t['platform.offboarding.loadError']()
        loadTraceId = apiClient.getLastTraceId()
      }
    } else {
      snapshot = offboardingResult.value
      idempotencyKey = offboardingResult.value.idempotency_key
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function defaultKey(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `offboarding-${stamp}-${random}`
}

$effect(() => {
  void id
  purgeRevealed = false
  void load()
})

// Monitor: the export and the purge are executed by the operator CLI, which
// advances this record through its state machine — the console watches the
// record until it settles. A terminal status stops the poll.
$effect(() => {
  const current = snapshot
  if (!current || TERMINAL_STATUSES.has(current.status)) return
  const timer = window.setInterval(() => {
    void refreshSnapshot()
  }, POLL_INTERVAL_MS)
  return () => window.clearInterval(timer)
})

async function refreshSnapshot(): Promise<void> {
  try {
    snapshot = await getOffboarding(apiClient, id)
  } catch {
    // A missed poll keeps the last known state; the next tick retries. The
    // status footer states when it was last updated, so staleness is named.
  }
}

async function start(): Promise<void> {
  if (!idempotencyKey.trim() || startSubmitting) return
  startSubmitting = true
  startError = undefined
  try {
    snapshot = await requestOffboarding(apiClient, id, { idempotencyKey: idempotencyKey.trim() })
    idempotencyKey = snapshot.idempotency_key
  } catch (error) {
    startError =
      error != null &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: number }).status === 409
        ? t['platform.offboarding.startConflict']()
        : t['platform.offboarding.startError']()
  } finally {
    startSubmitting = false
  }
}

const report = $derived(purgeReportOf(snapshot?.purge_report))
const exportEvidence = $derived(snapshot?.export ?? undefined)
// The purge step is offered only once the export has verified: the record
// must carry its evidence, and the purge must not already be under way or
// done. Before that, nothing purge-related renders at all.
const purgeOffered = $derived(
  snapshot?.status === 'exported' && snapshot.export != null && snapshot.export.checksum.length > 0,
)
const lifecycleGated = $derived(
  tenant != null && tenant.status !== 'suspended' && tenant.status !== 'archived',
)
const exportCommand = $derived(
  `just offboard -- --tenant ${tenant?.slug ?? '<slug>'} --key ${idempotencyKey} --stage export`,
)
const purgeCommand = $derived(
  `just offboard -- --tenant ${tenant?.slug ?? '<slug>'} --key ${idempotencyKey} --stage purge --confirm "offboard ${tenant?.slug ?? '<slug>'}" --neighbour <other-tenant-slug>`,
)

const statusVariant = $derived.by((): 'success' | 'info' | 'warning' | 'error' => {
  switch (snapshot?.status) {
    case 'purged':
      return 'success'
    case 'failed':
      return 'error'
    case 'purging':
    case 'exporting':
    case 'pending':
      return 'info'
    default:
      return 'warning'
  }
})

// The wire's status is `string` (the spec pins the vocabulary in prose); a
// status outside the documented set renders verbatim rather than lying.
const STATUSES = ['pending', 'exporting', 'exported', 'purging', 'purged', 'failed'] as const
type KnownStatus = (typeof STATUSES)[number]
function statusLabel(): string {
  const status = snapshot?.status
  if (status && (STATUSES as readonly string[]).includes(status)) {
    return t[`platform.offboarding.status.${status as KnownStatus}`]()
  }
  return status ?? ''
}

const created = $derived(snapshot ? new Date(snapshot.created_at) : undefined)
const updated = $derived(snapshot ? new Date(snapshot.updated_at) : undefined)
const completed = $derived(snapshot?.completed_at ? new Date(snapshot.completed_at) : undefined)
</script>

{#if loading}
  <Spinner label={t['common.loading']()} />
{:else if loadError}
  <EmptyState
    title={loadError}
    titleTag="h1"
  >
    {#snippet action()}
      <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
      {#if loadTraceId}
        <p>{t['errors.traceId']({ id: loadTraceId })}</p>
      {/if}
    {/snippet}
  </EmptyState>
{:else if tenant}
  <DetailShell
    title={t['platform.offboarding.title']()}
    subtitle={tenant.display_name}
    backHref="/tenants/{id}"
    backLabel={t['platform.offboarding.backToTenant']()}
    onNavigateBack={(event) => event.preventDefault()}
  >
    {#snippet children()}
      <Stack gap="4">
        {#if snapshot === undefined}
          <div data-offboarding="start-panel">
          <Stack gap="3">
            <h2>{t['platform.offboarding.notStartedTitle']()}</h2>
            <p>{t['platform.offboarding.explanation']()}</p>
            {#if lifecycleGated}
              <Alert variant="warning">
                {t['platform.offboarding.lifecycleGate']({ status: tenant?.status ?? '' })}
              </Alert>
            {/if}
            <Field label={t['platform.offboarding.keyLabel']()} required>
              {#snippet children(controlProps)}
                <Input {...controlProps} bind:value={idempotencyKey} autocomplete="off" />
              {/snippet}
            </Field>
            {#if startError}
              <Alert variant="error">{startError}</Alert>
            {/if}
            <div>
              <Button
                variant="primary"
                loading={startSubmitting}
                disabled={lifecycleGated || idempotencyKey.trim().length === 0}
                onclick={() => void start()}
              >
                {t['platform.offboarding.startCta']()}
              </Button>
            </div>
          </Stack>
          </div>
        {:else if snapshot}
          <div data-offboarding="status">
          <Stack gap="2">
            <div class="sanvi-offboarding__status-row">
              <h2>{t['platform.offboarding.statusHeading']()}</h2>
              <Badge variant={statusVariant}>{statusLabel()}</Badge>
            </div>
            <p class="sanvi-offboarding__meta">
              {t['platform.offboarding.keyLabel']()}: <code>{snapshot.idempotency_key}</code>
            </p>
            {#if created}
              <p class="sanvi-offboarding__meta">
                {t['platform.offboarding.requestedAt']({ time: created.toLocaleString() })}
              </p>
            {/if}
            {#if updated}
              <p class="sanvi-offboarding__meta">
                {t['platform.offboarding.updatedAt']({ time: updated.toLocaleString() })}
              </p>
            {/if}
            {#if completed}
              <p class="sanvi-offboarding__meta">
                {t['platform.offboarding.completedAt']({ time: completed.toLocaleString() })}
              </p>
            {/if}
            {#if snapshot.status === 'pending' || snapshot.status === 'exporting'}
              <p>{t['platform.offboarding.exportInProgress']()}</p>
            {:else if snapshot.status === 'purging'}
              <p>{t['platform.offboarding.purgeInProgress']()}</p>
            {:else if snapshot.status === 'failed' && snapshot.error}
              <Alert variant="error" title={t['platform.offboarding.failedTitle']()}>
                {t['platform.offboarding.failedBody']()}
                <code>{snapshot.error}</code>
              </Alert>
            {/if}
          </Stack>
          </div>

          {#if exportEvidence}
            <div data-offboarding="export-evidence">
            <Stack gap="2">
              <h3>{t['platform.offboarding.exportHeading']()}</h3>
              <p>{t['platform.offboarding.exportVerified']()}</p>
              <div class="sanvi-offboarding__evidence">
                <div class="sanvi-offboarding__evidence-row">
                  <span class="sanvi-offboarding__evidence-label">
                    {t['platform.offboarding.exportPathLabel']()}
                  </span>
                  <code>{exportEvidence.path}</code>
                  <CopyButton value={exportEvidence.path} />
                </div>
                <div class="sanvi-offboarding__evidence-row">
                  <span class="sanvi-offboarding__evidence-label">
                    {t['platform.offboarding.exportChecksumLabel']()}
                  </span>
                  <code>{exportEvidence.checksum}</code>
                  <CopyButton value={exportEvidence.checksum} />
                </div>
              </div>
              <p class="sanvi-offboarding__meta">{t['platform.offboarding.exportFetchNote']()}</p>
              <div class="sanvi-offboarding__command">
                <code>{exportCommand}</code>
                <CopyButton value={exportCommand} />
              </div>
            </Stack>
            </div>
          {/if}

          {#if purgeOffered}
            <div data-offboarding="purge-panel">
            <Stack gap="2">
              <h3>{t['platform.offboarding.purgeHeading']()}</h3>
              <Alert variant="error">{t['platform.offboarding.purgeConsequence']()}</Alert>
              {#if purgeRevealed}
                <div class="sanvi-offboarding__command" data-offboarding="purge-command">
                  <code>{purgeCommand}</code>
                  <CopyButton value={purgeCommand} />
                </div>
                <p class="sanvi-offboarding__meta">{t['platform.offboarding.purgeRunNote']()}</p>
              {:else}
                <div>
                  <Button variant="danger" onclick={() => (purgeConfirmOpen = true)}>
                    {t['platform.offboarding.purgeCta']()}
                  </Button>
                </div>
              {/if}
            </Stack>
            </div>
          {/if}

          {#if report}
            <div data-offboarding="report">
            <Stack gap="3">
              <h3>{t['platform.offboarding.reportHeading']()}</h3>
              <section aria-labelledby="sanvi-offboarding-removed">
                <h4 id="sanvi-offboarding-removed">{t['platform.offboarding.reportRemoved']()}</h4>
                <ul data-offboarding="report-removed">
                  {#each Object.entries(report.removed) as [table, count] (table)}
                    <li><code>{table}</code> — {count.toLocaleString()}</li>
                  {/each}
                  {#if report.archivesPurged > 0}
                    <li>{t['platform.offboarding.reportArchives']({ count: report.archivesPurged })}</li>
                  {/if}
                  {#if report.cacheKeysDeleted > 0}
                    <li>{t['platform.offboarding.reportCaches']({ count: report.cacheKeysDeleted })}</li>
                  {/if}
                  {#if Object.keys(report.removed).length === 0 && report.archivesPurged === 0 && report.cacheKeysDeleted === 0}
                    <li>{t['platform.offboarding.reportRemovedEmpty']()}</li>
                  {/if}
                </ul>
              </section>
              <section aria-labelledby="sanvi-offboarding-retained">
                <h4 id="sanvi-offboarding-retained">
                  {t['platform.offboarding.reportRetained']()}
                </h4>
                <ul data-offboarding="report-retained">
                  {#each report.lawfullyRetained as entry (entry.table + ':' + entry.dataClass)}
                    <li>
                      <code>{entry.table}</code> — {entry.rowsRetained.toLocaleString()} —
                      {entry.legalBasis} —
                      {entry.retentionEnd
                        ? t['platform.offboarding.retentionEnd']({
                            date: new Date(entry.retentionEnd).toLocaleDateString(),
                          })
                        : t['platform.offboarding.retentionNoEnd']()}
                    </li>
                  {/each}
                  {#if report.lawfullyRetained.length === 0}
                    <li>{t['platform.offboarding.reportRetainedEmpty']()}</li>
                  {/if}
                </ul>
              </section>
              <Stack gap="1">
                {#if report.neighbour}
                  <p class="sanvi-offboarding__meta">
                    {report.neighbour.byteIdentical
                      ? t['platform.offboarding.neighbourProof']({ tenant: report.neighbour.tenant })
                      : t['platform.offboarding.neighbourFailed']({ tenant: report.neighbour.tenant })}
                  </p>
                {/if}
                {#if report.residualScan}
                  <p class="sanvi-offboarding__meta">
                    {t['platform.offboarding.residualScan']({ result: report.residualScan })}
                  </p>
                {/if}
                {#if report.backupPolicyNote}
                  <p class="sanvi-offboarding__meta">{report.backupPolicyNote}</p>
                {/if}
                {#if report.objectStorageNote}
                  <p class="sanvi-offboarding__meta">{report.objectStorageNote}</p>
                {/if}
                {#if report.searchIndexesNote}
                  <p class="sanvi-offboarding__meta">{report.searchIndexesNote}</p>
                {/if}
              </Stack>
            </Stack>
            </div>
          {/if}
        {/if}
      </Stack>
    {/snippet}
  </DetailShell>
{/if}

<DangerousAction
  bind:open={purgeConfirmOpen}
  titleText={t['platform.offboarding.purgeConfirmTitle']()}
  consequence={t['platform.offboarding.purgeConsequence']()}
  confirmationPhrase={tenant?.slug}
  confirmationLabel={t['platform.offboarding.confirmationLabel']()}
  reasonLabel={t['platform.offboarding.reasonLabel']()}
  minReasonLength={0}
  confirmLabel={t['platform.offboarding.purgeConfirmCta']()}
  onConfirm={() => {
    purgeRevealed = true
    purgeConfirmOpen = false
  }}
/>

<style>
  .sanvi-offboarding__status-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-offboarding__meta {
    color: var(--sanvi-color-text-secondary);
    margin: 0;
  }

  .sanvi-offboarding__evidence {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-offboarding__evidence-row {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    flex-wrap: wrap;
  }

  .sanvi-offboarding__evidence-label {
    min-width: 12ch;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-offboarding__command {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    background: var(--sanvi-color-surface-subtle, var(--sanvi-color-surface-base));
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    overflow-wrap: anywhere;
  }
</style>
