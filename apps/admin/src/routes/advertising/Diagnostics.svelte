<script lang="ts">
import { can } from '@sanvi/auth'
import {
  ApiError,
  getAdConversionDiagnostics,
  listAdConversions,
  listAdPlatforms,
  retryAdConversion,
} from '@sanvi/api-client'
import type { ConversionDiagnostics, ConversionEvent, UploadState } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Container,
  EmptyState,
  Field,
  HealthBanner,
  NO_VALUE,
  ReasonBadge,
  Select,
  Spinner,
  Stack,
  UpgradePrompt,
  formatAdCurrency,
  humanizeOptionValue,
  showToast,
  type AdHealthFigure,
  type AdReasonCategory,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  canRetry,
  diagnosticsHealth,
  failureCategory,
  healthBannerLevel,
  primaryCategory,
  rowOutcome,
  suppressionCategory,
  uploadCategory,
  type RowOutcome,
} from '../../lib/advertising/diagnostics'
import { conversionCurrency, conversionValue, purposeLabel } from '../../lib/advertising/tracking'

/**
 * The conversion-diagnostics screen (phase 10, TASK-015 / slice 10.6).
 *
 * This is the screen that turns "the numbers look wrong" into a specific,
 * fixable cause — and, just as importantly, separates the causes a tenant
 * can fix from the ones they must respect. The taxonomy badge on every row
 * carries that split: the four directive-decided categories render neutral
 * (a working privacy system is not an incident), the three delivery
 * problems render alert tones. The health banner keeps its two figures —
 * suppression share and upload failure ratio — as separate entries with
 * separate copy for the same reason.
 *
 * Every taxonomy category has its own message through the compile-time
 * exhaustive `CATEGORY_COPY` record: a category added to the taxonomy
 * fails the build here rather than falling through to a generic string.
 * The retry control exists only for parked rows — on a directive-
 * suppressed row it would be a compliance trap, so it does not render
 * (the backend's retry endpoint refuses those events regardless).
 */
let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let trackingEnabled = $state(true)
let events = $state<ConversionEvent[]>([])
let platformNames = $state<Record<string, string>>({})

let outcomeFilter = $state<'all' | RowOutcome>('all')
let expandedId = $state<string | null>(null)
let detail = $state<ConversionDiagnostics | null>(null)
let detailLoading = $state(false)
let detailError = $state(false)
let retryingId = $state<string | null>(null)

const detailCache = new Map<string, ConversionDiagnostics>()

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  events = []
  expandedId = null
  detail = null
  trackingEnabled = hasFeature('advertising.conversion_tracking')

  try {
    const [list, catalog] = await Promise.all([
      listAdConversions(apiClient),
      listAdPlatforms(apiClient).catch(() => undefined),
    ])
    if (seq !== loadSeq) return
    events = list ?? []
    const names: Record<string, string> = {}
    for (const platform of catalog?.platforms ?? []) {
      names[platform.key] = platform.display_name
    }
    platformNames = names
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))

const filteredEvents = $derived(
  outcomeFilter === 'all' ? events : events.filter((event) => rowOutcome(event) === outcomeFilter),
)

const health = $derived(diagnosticsHealth(filteredEvents))
const bannerLevel = $derived(healthBannerLevel(health))

const bannerFigures = $derived.by(() => {
  const figures: AdHealthFigure[] = []
  if (health.suppressionShare !== null) {
    figures.push({
      key: 'suppression',
      value: percent(health.suppressionShare),
      label: t['admin.advertising.diagnostics.banner.suppressionLabel'](),
      description: t['admin.advertising.diagnostics.banner.suppressionDescription']({
        consentAbsent: fmt.number(health.consentAbsent),
        optedOut: fmt.number(health.optedOut),
        browserSignal: fmt.number(health.browserSignal),
      }),
    })
  }
  if (health.uploadFailureRatio !== null && health.attempted > 0) {
    figures.push({
      key: 'failures',
      value: percent(health.uploadFailureRatio),
      label: t['admin.advertising.diagnostics.banner.failureLabel'](),
      description: t['admin.advertising.diagnostics.banner.failureDescription']({
        failing: fmt.number(health.failing),
        attempted: fmt.number(health.attempted),
      }),
    })
  }
  return figures
})

/** One column per platform that appears in the loaded window, first-seen order. */
const platformColumns = $derived.by(() => {
  const keys: string[] = []
  for (const event of events) {
    for (const key of Object.keys(event.upload_states ?? {})) {
      if (!keys.includes(key)) keys.push(key)
    }
  }
  return keys.map((key) => ({ key, name: platformNames[key] ?? humanizeOptionValue(key) }))
})

function percent(value: number): string {
  return fmt.number(value, { style: 'percent', maximumFractionDigits: 0 })
}

/**
 * The compile-time exhaustive taxonomy copy: every category carries its own
 * label, what happened, and what — if anything — the tenant can do. The
 * first four categories' action copy deliberately says "nothing to fix":
 * they are the privacy system working, and their badge tone agrees.
 */
const CATEGORY_COPY: Record<
  AdReasonCategory,
  { label: () => string; what: () => string; action: () => string }
> = {
  missing_consent: {
    label: () => t['admin.advertising.diagnostics.category.missing_consent.label'](),
    what: () => t['admin.advertising.diagnostics.category.missing_consent.what'](),
    action: () => t['admin.advertising.diagnostics.category.missing_consent.action'](),
  },
  opted_out_sale_share: {
    label: () => t['admin.advertising.diagnostics.category.opted_out_sale_share.label'](),
    what: () => t['admin.advertising.diagnostics.category.opted_out_sale_share.what'](),
    action: () => t['admin.advertising.diagnostics.category.opted_out_sale_share.action'](),
  },
  browser_privacy_signal: {
    label: () => t['admin.advertising.diagnostics.category.browser_privacy_signal.label'](),
    what: () => t['admin.advertising.diagnostics.category.browser_privacy_signal.what'](),
    action: () => t['admin.advertising.diagnostics.category.browser_privacy_signal.action'](),
  },
  withdrawn_after_capture: {
    label: () => t['admin.advertising.diagnostics.category.withdrawn_after_capture.label'](),
    what: () => t['admin.advertising.diagnostics.category.withdrawn_after_capture.what'](),
    action: () => t['admin.advertising.diagnostics.category.withdrawn_after_capture.action'](),
  },
  missing_click_id: {
    label: () => t['admin.advertising.diagnostics.category.missing_click_id.label'](),
    what: () => t['admin.advertising.diagnostics.category.missing_click_id.what'](),
    action: () => t['admin.advertising.diagnostics.category.missing_click_id.action'](),
  },
  token_expired: {
    label: () => t['admin.advertising.diagnostics.category.token_expired.label'](),
    what: () => t['admin.advertising.diagnostics.category.token_expired.what'](),
    action: () => t['admin.advertising.diagnostics.category.token_expired.action'](),
  },
  upload_error: {
    label: () => t['admin.advertising.diagnostics.category.upload_error.label'](),
    what: () => t['admin.advertising.diagnostics.category.upload_error.what'](),
    action: () => t['admin.advertising.diagnostics.category.upload_error.action'](),
  },
}

const filterOptions = $derived([
  { value: 'all', label: t['admin.advertising.diagnostics.filterAll']() },
  { value: 'permitted', label: t['admin.advertising.diagnostics.filterPermitted']() },
  { value: 'suppressed', label: t['admin.advertising.diagnostics.filterSuppressed']() },
  { value: 'upload_issues', label: t['admin.advertising.diagnostics.filterUploadIssues']() },
])

function categoryCopy(category: AdReasonCategory) {
  return CATEGORY_COPY[category]
}

function statusLabel(state: UploadState): string {
  switch (state.status) {
    case 'pending':
      return t['admin.advertising.diagnostics.status.pending']()
    case 'uploaded':
      return t['admin.advertising.diagnostics.status.uploaded']()
    case 'failed':
      return t['admin.advertising.diagnostics.status.failed']()
    case 'parked':
      return t['admin.advertising.diagnostics.status.parked']()
    case 'retracted':
      return t['admin.advertising.diagnostics.status.retracted']()
    case 'unpropagated':
      return t['admin.advertising.diagnostics.status.unpropagated']()
  }
}

function statusTone(state: UploadState): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (state.status) {
    case 'pending':
      return 'info'
    case 'uploaded':
      return 'success'
    case 'failed':
      return 'warning'
    case 'parked':
      return 'error'
    case 'retracted':
      return 'neutral'
    case 'unpropagated':
      return 'warning'
  }
}

function sourceLabel(source: string): string {
  if (source === 'payment_record') return t['admin.advertising.conversions.sourcePaymentRecord']()
  if (source === 'client_reported') return t['admin.advertising.conversions.sourceClientReported']()
  return humanizeOptionValue(source)
}

function valueText(event: ConversionEvent): string {
  const amountMinor = conversionValue(event)
  const currency = conversionCurrency(event)
  if (amountMinor === null || !currency) return NO_VALUE
  return formatAdCurrency(amountMinor, currency)
}

function outcomeText(event: ConversionEvent): string {
  const category = primaryCategory(event)
  if (!category) return t['admin.advertising.diagnostics.outcomePermitted']()
  return categoryCopy(category).label()
}

/** A truncated identifier preview — hashed identifiers render verbatim; click ids render masked. */
function maskId(value: string): string {
  if (value.length <= 8) return `…${value.slice(-2)}`
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbc', 'fbp'] as const

function clickIdEntries(event: ConversionEvent): [string, string][] {
  return CLICK_ID_KEYS.filter((key) => Boolean(event.click_ids[key])).map((key) => [
    key,
    maskId(event.click_ids[key] as string),
  ])
}

function hashedEntries(event: ConversionEvent): [string, string][] {
  return Object.entries(event.hashed_identifiers ?? {})
}

async function toggleExpanded(event: ConversionEvent): Promise<void> {
  if (expandedId === event.id) {
    expandedId = null
    detail = null
    return
  }
  expandedId = event.id
  detailError = false
  const cached = detailCache.get(event.id)
  if (cached) {
    detail = cached
    return
  }
  detail = null
  detailLoading = true
  try {
    const result = await getAdConversionDiagnostics(apiClient, event.id)
    detailCache.set(event.id, result)
    if (expandedId === event.id) detail = result
  } catch {
    if (expandedId === event.id) detailError = true
  } finally {
    detailLoading = false
  }
}

async function retry(event: ConversionEvent): Promise<void> {
  retryingId = event.id
  try {
    const updated = await retryAdConversion(apiClient, event.id)
    events = events.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    detailCache.delete(event.id)
    if (expandedId === event.id) {
      detail = null
      void toggleExpanded(updated)
    }
    showToast({
      title: t['admin.advertising.diagnostics.retrySuccessToast'](),
      variant: 'success',
    })
  } catch {
    showToast({
      title: t['admin.advertising.diagnostics.retryErrorToast'](),
      variant: 'error',
    })
  } finally {
    retryingId = null
  }
}

function suppressedText(event: ConversionEvent): string {
  const outcome = suppressionCategory(event.consent)
  return t['admin.advertising.diagnostics.suppressedBy']({
    purpose: purposeLabel(deniedPurpose(event)),
    source: humanizeOptionValue(event.consent.signal_source),
  })
}

function deniedPurpose(event: ConversionEvent): string {
  const denied = Object.entries(event.consent.answers).find(([, answer]) => answer === 'denied')
  return denied?.[0] ?? ''
}

function failureReason(event: ConversionEvent, platformKey: string): string | null {
  const state = event.upload_states?.[platformKey]
  if (!state || (state.status !== 'failed' && state.status !== 'parked')) return null
  return state.reason
}

function platformCategory(event: ConversionEvent, platformKey: string): AdReasonCategory | null {
  const state = event.upload_states?.[platformKey]
  if (!state) return null
  return uploadCategory(state)
}

function uploadStateOf(event: ConversionEvent, platformKey: string): UploadState | null {
  return event.upload_states?.[platformKey] ?? null
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.diagnostics.title']()}</h1>
      <p>{t['admin.advertising.diagnostics.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={() => void load()}>
          {t['common.retry']()}
        </Button>
      </Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      {#if !trackingEnabled}
        <Alert variant="warning">
          <p>{t['admin.advertising.diagnostics.pausedTitle']()}</p>
          <p>{t['admin.advertising.diagnostics.pausedBody']()}</p>
        </Alert>
      {/if}

      {#if bannerLevel !== 'none' && bannerFigures.length > 0}
        <HealthBanner
          title={
            bannerLevel === 'error'
              ? t['admin.advertising.diagnostics.banner.title.error']()
              : t['admin.advertising.diagnostics.banner.title.warning']()
          }
          figures={bannerFigures}
          tone={bannerLevel}
        />
      {/if}

      {#if events.length === 0}
        <EmptyState
          title={t['admin.advertising.conversions.emptyTitle']()}
          description={t['admin.advertising.conversions.emptyBody']()}
        />
      {:else}
        <div class="sanvi-diagnostics__toolbar">
          <Field label={t['admin.advertising.diagnostics.filterLabel']()}>
            {#snippet children(controlProps)}
              <Select {...controlProps} bind:value={outcomeFilter} options={filterOptions} />
            {/snippet}
          </Field>
        </div>

        {#if filteredEvents.length === 0}
          <EmptyState
            title={t['admin.advertising.diagnostics.emptyFilteredTitle']()}
            description={t['admin.advertising.diagnostics.emptyFilteredBody']()}
          />
        {:else}
          <div class="sanvi-diagnostics__scroll">
            <table class="sanvi-diagnostics__table">
              <caption>{t['admin.advertising.diagnostics.caption']()}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span class="sanvi-visually-hidden">
                      {t['admin.advertising.diagnostics.actionsHeader']()}
                    </span>
                  </th>
                  <th scope="col">{t['admin.advertising.conversions.columnOccurredAt']()}</th>
                  <th scope="col">{t['admin.advertising.conversions.columnEvent']()}</th>
                  <th scope="col">{t['admin.advertising.conversions.columnValue']()}</th>
                  <th scope="col">{t['admin.advertising.conversions.columnOutcome']()}</th>
                  {#each platformColumns as platform (platform.key)}
                    <th scope="col">{platform.name}</th>
                  {/each}
                  <th scope="col">{t['admin.advertising.diagnostics.actionsHeader']()}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredEvents as event (event.id)}
                  {@const expanded = expandedId === event.id}
                  <tr>
                    <td>
                      <button
                        type="button"
                        class="sanvi-diagnostics__toggle"
                        aria-expanded={expanded}
                        aria-controls={expanded ? 'diagnostics-detail-' + event.id : undefined}
                        aria-label={expanded
                          ? t['admin.advertising.diagnostics.collapseLabel']({
                              event: event.name,
                            })
                          : t['admin.advertising.diagnostics.expandLabel']({ event: event.name })}
                        onclick={() => void toggleExpanded(event)}
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td>{fmt.datetime(new Date(event.occurred_at))}</td>
                    <td>{event.name}</td>
                    <td class="sanvi-diagnostics__value">{valueText(event)}</td>
                    <td>
                      <Stack gap="1">
                        {@const category = primaryCategory(event)}
                        {#if category}
                          <ReasonBadge category={category} label={categoryCopy(category).label()} />
                        {/if}
                        {#if event.consent.answers[deniedPurpose(event)] === 'denied'}
                          <span class="sanvi-diagnostics__suppressed-by">
                            {suppressedText(event)}
                          </span>
                        {/if}
                      </Stack>
                    </td>
                    {#each platformColumns as platform (platform.key)}
                      {@const state = uploadStateOf(event, platform.key)}
                      <td>
                        {#if state}
                          {@const platformStateCategory = platformCategory(event, platform.key)}
                          <Stack gap="1">
                            <Badge variant={statusTone(state)}>{statusLabel(state)}</Badge>
                            {#if state.status === 'failed' || state.status === 'parked'}
                              <span class="sanvi-diagnostics__attempts">
                                {t['admin.advertising.diagnostics.attemptsLabel']({
                                  attempts:
                                    (state.status === 'parked'
                                      ? state.attempts
                                      : state.attempt_count) ?? 0,
                                })}
                              </span>
                            {/if}
                            {#if platformStateCategory && platformStateCategory !== 'upload_error'}
                              <span class="sanvi-diagnostics__platform-category">
                                {categoryCopy(platformStateCategory).label()}
                              </span>
                            {/if}
                          </Stack>
                        {:else}
                          {NO_VALUE}
                        {/if}
                      </td>
                    {/each}
                    <td>
                      {#if writable && canRetry(event)}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={retryingId === event.id}
                          onclick={() => void retry(event)}
                        >
                          {t['admin.advertising.diagnostics.retryLabel']()}
                          <span class="sanvi-visually-hidden">: {event.name}</span>
                        </Button>
                      {/if}
                    </td>
                  </tr>
                  {#if expanded}
                    <tr class="sanvi-diagnostics__detail-row">
                      <td colspan={6 + platformColumns.length}>
                        <div
                          id={'diagnostics-detail-' + event.id}
                          role="region"
                          aria-labelledby={'diagnostics-detail-heading-' + event.id}
                          class="sanvi-diagnostics__detail"
                        >
                          <Stack gap="4">
                            {#if detailLoading}
                              <Spinner label={t['admin.advertising.loading']()} />
                            {:else if detailError}
                              <Alert variant="error">
                                {t['admin.advertising.genericError']()}
                              </Alert>
                            {:else}
                              <h2 id={'diagnostics-detail-heading-' + event.id}>
                                {t['admin.advertising.diagnostics.detail.regionLabel']({
                                  event: event.name,
                                })}
                              </h2>

                              {@const category = primaryCategory(event)}
                              {#if category}
                                <ReasonBadge
                                  category={category}
                                  label={categoryCopy(category).label()}
                                />
                                <p>{categoryCopy(category).what()}</p>
                                <p>{categoryCopy(category).action()}</p>
                              {/if}

                              <div>
                                <h3>{t['admin.advertising.diagnostics.detail.identityHeading']()}</h3>
                                <dl class="sanvi-diagnostics__list">
                                  <div class="sanvi-diagnostics__row">
                                    <dt>{t['admin.advertising.diagnostics.detail.capturedAt']()}</dt>
                                    <dd>
                                      {fmt.datetime(
                                        new Date(detail?.captured_at ?? event.occurred_at),
                                      )}
                                    </dd>
                                  </div>
                                  <div class="sanvi-diagnostics__row">
                                    <dt>{t['admin.advertising.diagnostics.detail.eventId']()}</dt>
                                    <dd class="sanvi-diagnostics__mono">{event.event_id}</dd>
                                  </div>
                                  <div class="sanvi-diagnostics__row">
                                    <dt>{t['admin.advertising.diagnostics.detail.orderRef']()}</dt>
                                    <dd>{event.order_ref ?? NO_VALUE}</dd>
                                  </div>
                                </dl>
                                <p class="sanvi-diagnostics__note">
                                  {t['admin.advertising.diagnostics.detail.identityNote']()}
                                </p>
                              </div>

                              <div>
                                <h3>{t['admin.advertising.diagnostics.detail.clickIdsHeading']()}</h3>
                                {#if clickIdEntries(event).length === 0}
                                  <p>{t['admin.advertising.diagnostics.detail.clickIdsNone']()}</p>
                                {:else}
                                  <ul class="sanvi-diagnostics__mono-list">
                                    {#each clickIdEntries(event) as [name, masked] (name)}
                                      <li>
                                        <span class="sanvi-diagnostics__key">{name}</span>
                                        {masked}
                                      </li>
                                    {/each}
                                  </ul>
                                {/if}
                              </div>

                              <div>
                                <h3>
                                  {t['admin.advertising.diagnostics.detail.valueSource']()}
                                </h3>
                                <p>
                                  {event.value_source ? sourceLabel(event.value_source) : NO_VALUE}
                                  ·
                                  {valueText(event)}
                                </p>
                              </div>

                              <div>
                                <h3>
                                  {t['admin.advertising.diagnostics.detail.snapshotHeading']()}
                                </h3>
                                <dl class="sanvi-diagnostics__list">
                                  {#each event.consent.purposes_asked as purpose (purpose)}
                                    <div class="sanvi-diagnostics__row">
                                      <dt>{purposeLabel(purpose)}</dt>
                                      <dd>
                                        {event.consent.answers[purpose] === 'denied'
                                          ? t['admin.advertising.tracking.resultAnswerDenied']()
                                          : t['admin.advertising.tracking.resultAnswerAllowed']()}
                                      </dd>
                                    </div>
                                  {/each}
                                  <div class="sanvi-diagnostics__row">
                                    <dt>
                                      {t['admin.advertising.tracking.resultJurisdictionLabel']()}
                                    </dt>
                                    <dd>{event.consent.jurisdiction}</dd>
                                  </div>
                                  <div class="sanvi-diagnostics__row">
                                    <dt>
                                      {t['admin.advertising.tracking.resultSignalSourceLabel']()}
                                    </dt>
                                    <dd>{humanizeOptionValue(event.consent.signal_source)}</dd>
                                  </div>
                                  <div class="sanvi-diagnostics__row">
                                    <dt>
                                      {t['admin.advertising.tracking.resultResolverVersionLabel']()}
                                    </dt>
                                    <dd class="sanvi-diagnostics__mono">
                                      {event.consent.resolver_version}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              <div>
                                <h3>
                                  {t['admin.advertising.diagnostics.detail.platformsHeading']()}
                                </h3>
                                {#if Object.keys(event.upload_states ?? {}).length === 0}
                                  <p>{suppressedText(event)}</p>
                                {:else}
                                  <dl class="sanvi-diagnostics__list">
                                    {#each Object.entries(event.upload_states ?? {}) as [platformKey, state] (platformKey)}
                                      <div class="sanvi-diagnostics__row">
                                        <dt>
                                          {platformNames[platformKey] ??
                                            humanizeOptionValue(platformKey)}
                                        </dt>
                                        <dd>
                                          <Stack gap="1">
                                            <span>{statusLabel(state)}</span>
                                            {#if state.status === 'failed' || state.status === 'parked'}
                                              <span class="sanvi-diagnostics__note">
                                                {failureCategory(state.reason) === 'upload_error'
                                                  ? t['admin.advertising.diagnostics.detail.platformError'](
                                                      { error: state.reason },
                                                    )
                                                  : categoryCopy(failureCategory(state.reason)).what()}
                                              </span>
                                            {/if}
                                          </Stack>
                                        </dd>
                                      </div>
                                    {/each}
                                  </dl>
                                {/if}
                              </div>

                              <div>
                                <h3>{t['admin.advertising.diagnostics.detail.hashedHeading']()}</h3>
                                {#if hashedEntries(event).length === 0}
                                  <p>{t['admin.advertising.diagnostics.detail.hashedNone']()}</p>
                                {:else}
                                  <ul class="sanvi-diagnostics__mono-list">
                                    {#each hashedEntries(event) as [name, hash] (name)}
                                      <li>
                                        <span class="sanvi-diagnostics__key">{name}</span>
                                        {hash}
                                      </li>
                                    {/each}
                                  </ul>
                                {/if}
                              </div>
                            {/if}
                          </Stack>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}

      <div>
        <Button variant="secondary" onclick={() => navigate('/advertising/tracking')}>
          {t['admin.advertising.conversions.backToSetup']()}
        </Button>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-diagnostics__toolbar {
    max-width: var(--sanvi-spacing-48);
  }

  .sanvi-diagnostics__scroll {
    overflow-x: auto;
  }

  .sanvi-diagnostics__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-diagnostics__table caption {
    text-align: start;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diagnostics__table th,
  .sanvi-diagnostics__table td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: left;
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    vertical-align: top;
  }

  .sanvi-diagnostics__table th {
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-diagnostics__value {
    font-variant-numeric: tabular-nums;
  }

  .sanvi-diagnostics__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--sanvi-spacing-6);
    min-height: var(--sanvi-spacing-6);
    padding: var(--sanvi-spacing-1);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: transparent;
    color: var(--sanvi-color-text-primary);
    font: inherit;
    cursor: pointer;
  }

  .sanvi-diagnostics__toggle:hover {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-diagnostics__suppressed-by,
  .sanvi-diagnostics__attempts,
  .sanvi-diagnostics__platform-category,
  .sanvi-diagnostics__note {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diagnostics__detail-row > td {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-diagnostics__detail {
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-diagnostics__detail h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-diagnostics__detail h3 {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diagnostics__list {
    margin: 0;
  }

  .sanvi-diagnostics__row {
    display: flex;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-1) 0;
  }

  .sanvi-diagnostics__row dt {
    min-width: var(--sanvi-spacing-32);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-diagnostics__row dd {
    margin: 0;
  }

  .sanvi-diagnostics__mono,
  .sanvi-diagnostics__mono-list {
    font-family: var(--sanvi-font-family-mono);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-diagnostics__mono-list {
    margin: 0;
    padding-left: var(--sanvi-spacing-6);
    word-break: break-all;
  }

  .sanvi-diagnostics__key {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
