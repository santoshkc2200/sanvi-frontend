<script lang="ts">
import {
  ApiError,
  getAdTrackingSettings,
  listAdPlatforms,
  putAdTrackingSettings,
  testAdTrackingEvent,
} from '@sanvi/api-client'
import type { PlatformView, TestTrackingEventResponse, TrackingSettings } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Button,
  Cluster,
  Container,
  EmptyState,
  Field,
  Input,
  NO_VALUE,
  Spinner,
  Stack,
  UpgradePrompt,
  formatAdCurrency,
  humanizeOptionValue,
  showToast,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import { directiveOutcome, purposeLabel } from '../../lib/advertising/tracking'

/**
 * The conversion-tracking setup screen (phase 10, TASK-014 / slice 10.5).
 *
 * Three things live here, and the screen keeps them visibly separate:
 * what the storefront *captures* (one `purchase` event per paid order,
 * fired same-origin), where each event *uploads* (the per-platform mapping
 * matrix — one event can map to a different conversion action per platform,
 * so it renders as a matrix, not a list), and the *privacy dependency*
 * between the two: a capture always happens, an upload only happens while
 * the directives permit it. "Captured" and "uploaded" are different words
 * on this screen on purpose — conflating them makes the diagnostics screen
 * unreadable.
 *
 * The flag-off rollback state is explicit: `advertising.conversion_tracking`
 * off means the beacon is not emitted and events are lost for the duration,
 * never queued — the notice says exactly that instead of rendering a form
 * that would silently do nothing.
 */
let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let trackingEnabled = $state(false)
let settings = $state<TrackingSettings | null>(null)
let platforms = $state<PlatformView[]>([])

// The editable copy of the matrix: one row per event, the per-platform
// action ids as strings. Saved back as one object — the PUT replaces the
// whole mapping set, so the screen round-trips exactly what it rendered.
let rows = $state<{ event: string; actions: Record<string, string> }[]>([])
let newEventName = $state('')
let saving = $state(false)

// One-click test event: idle → sending → result, all within one interaction.
let testEventName = $state('purchase')
let testValue = $state('')
let testCurrency = $state('')
let testOrderRef = $state('')
let testSending = $state(false)
let testResult = $state<TestTrackingEventResponse | null>(null)
let testError = $state(false)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  settings = null
  platforms = []
  rows = []
  testResult = null
  trackingEnabled = hasFeature('advertising.conversion_tracking')

  if (!trackingEnabled) {
    // Rollback state: say what actually happens (no beacon, nothing queued)
    // rather than rendering a form that would silently do nothing.
    loading = false
    return
  }

  try {
    const catalog = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = (catalog?.platforms ?? []).filter(
      (platform) => platform.available && !platform.upgrade_required,
    )
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      // 403: no platform entitlement; 404: the advertising flag is off and
      // the route does not exist — the feature is simply not there.
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
    loading = false
    return
  }

  try {
    const result = await getAdTrackingSettings(apiClient)
    if (seq !== loadSeq) return
    settings = result
    rows = Object.entries(result.mappings).map(([event, actions]) => ({
      event,
      actions: { ...actions },
    }))
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.advertising.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function addEvent(): void {
  const event = newEventName.trim()
  if (!event || rows.some((row) => row.event === event)) return
  rows = [...rows, { event, actions: {} }]
  newEventName = ''
}

function removeEvent(event: string): void {
  rows = rows.filter((row) => row.event !== event)
}

async function save(): Promise<void> {
  if (!settings) return
  saving = true
  try {
    const mappings: TrackingSettings['mappings'] = {}
    for (const row of rows) {
      const actions: Record<string, string> = {}
      for (const [platform, action] of Object.entries(row.actions)) {
        if (action.trim()) actions[platform] = action.trim()
      }
      mappings[row.event] = actions
    }
    await putAdTrackingSettings(apiClient, { ...settings, mappings })
    showToast({
      title: t['admin.advertising.tracking.savedToast'](),
      variant: 'success',
    })
  } catch {
    showToast({
      title: t['admin.advertising.tracking.saveError'](),
      variant: 'error',
    })
  } finally {
    saving = false
  }
}

async function sendTestEvent(): Promise<void> {
  testSending = true
  testResult = null
  testError = false
  const value = testValue.trim() ? Number(testValue.trim()) : null
  try {
    const result = await testAdTrackingEvent(apiClient, {
      // A synthetic id minted per send: the test event never persists, so
      // the storefront's never-mint-a-real-id rule does not apply here.
      event_id: crypto.randomUUID(),
      event_name: testEventName.trim() || 'purchase',
      ...(value !== null && Number.isFinite(value) ? { value } : {}),
      ...(testCurrency.trim() ? { currency: testCurrency.trim().toUpperCase() } : {}),
      ...(testOrderRef.trim() ? { order_ref: testOrderRef.trim() } : {}),
    })
    testResult = result
  } catch {
    testError = true
  } finally {
    testSending = false
  }
}

function answerLabel(answer: string | undefined): string {
  return answer === 'denied'
    ? t['admin.advertising.tracking.resultAnswerDenied']()
    : t['admin.advertising.tracking.resultAnswerAllowed']()
}

const testValueDisplay = $derived.by(() => {
  const captured = testResult?.captured
  if (!captured?.value) return NO_VALUE
  return formatAdCurrency(captured.value.amount_minor, captured.value.currency)
})

const testOutcome = $derived(testResult ? directiveOutcome(testResult.captured.consent) : null)

const clickIdEntries = $derived.by(() => {
  const ids = testResult?.captured.click_ids
  if (!ids) return []
  return Object.entries({
    gclid: ids.gclid,
    gbraid: ids.gbraid,
    wbraid: ids.wbraid,
    fbc: ids.fbc,
    fbp: ids.fbp,
  }).filter((entry): entry is [string, string] => Boolean(entry[1]))
})

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.tracking.title']()}</h1>
      <p>{t['admin.advertising.tracking.description']()}</p>
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
    {:else if !trackingEnabled}
      <Alert variant="warning">
        <p>{t['admin.advertising.tracking.disabledTitle']()}</p>
        <p>{t['admin.advertising.tracking.disabledBody']()}</p>
      </Alert>
    {:else}
      <section aria-labelledby="tracking-capture-heading">
        <Stack gap="4">
          <h2 id="tracking-capture-heading">
            {t['admin.advertising.tracking.captureHeading']()}
          </h2>
          <p>{t['admin.advertising.tracking.captureBody']({ event: 'purchase' })}</p>
        </Stack>
      </section>

      <section aria-labelledby="tracking-matrix-heading">
        <Stack gap="4">
          <h2 id="tracking-matrix-heading">
            {t['admin.advertising.tracking.matrixHeading']()}
          </h2>
          <p>{t['admin.advertising.tracking.matrixDescription']()}</p>

          {#if platforms.length === 0}
            <EmptyState
              title={t['admin.advertising.tracking.emptyMappingsTitle']()}
              description={t['admin.advertising.tracking.noPlatformsBody']()}
            />
          {:else}
            {#if rows.length === 0}
              <EmptyState
                title={t['admin.advertising.tracking.emptyMappingsTitle']()}
                description={t['admin.advertising.tracking.emptyMappingsBody']()}
              />
            {:else}
              <div class="tracking-matrix-scroll">
                <table class="tracking-matrix">
                  <thead>
                    <tr>
                      <th scope="col">
                        {t['admin.advertising.tracking.matrixEventHeader']()}
                      </th>
                      {#each platforms as platform (platform.key)}
                        <th scope="col">{platform.display_name}</th>
                      {/each}
                      <th scope="col">{t['admin.advertising.tracking.matrixActionsHeader']()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each rows as row, rowIndex (row.event)}
                      <tr>
                        <th scope="row">{row.event}</th>
                        {#each platforms as platform, platformIndex (platform.key)}
                          <td>
                            <label
                              class="sanvi-visually-hidden"
                              for={'tracking-action-' + rowIndex + '-' + platformIndex}
                            >
                              {t['admin.advertising.tracking.matrixActionLabel']({
                                platform: platform.display_name,
                              })}
                            </label>
                            <!-- value + oninput, not bind: an event the mapping
                               doesn't cover has no key in `actions` yet, and the
                               cell still edits (and creates) it. -->
                            <Input
                              id={'tracking-action-' + rowIndex + '-' + platformIndex}
                              value={row.actions[platform.key] ?? ''}
                              oninput={(event) => {
                                row.actions[platform.key] = event.currentTarget.value
                              }}
                            />
                          </td>
                        {/each}
                        <td>
                          <Button variant="secondary" onclick={() => removeEvent(row.event)}>
                            {t['admin.advertising.tracking.removeLabel']()}
                            <span class="sanvi-visually-hidden">: {row.event}</span>
                          </Button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}

            <Cluster gap="4" align="end">
              <Field label={t['admin.advertising.tracking.addEventPlaceholder']()}>
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={newEventName}
                    placeholder={t['admin.advertising.tracking.addEventPlaceholder']()}
                  />
                {/snippet}
              </Field>
              <Button variant="secondary" onclick={addEvent}>
                {t['admin.advertising.tracking.addEventLabel']()}
              </Button>
              <Button variant="primary" onclick={() => void save()} disabled={saving}>
                {saving
                  ? t['admin.advertising.tracking.savingLabel']()
                  : t['admin.advertising.tracking.saveLabel']()}
              </Button>
            </Cluster>
          {/if}
        </Stack>
      </section>

      <Alert variant="info">
        <Stack gap="2">
          <p>{t['admin.advertising.tracking.consentHeading']()}</p>
          <p>
            {t['admin.advertising.tracking.consentBody']({
              adsMeasurement: purposeLabel('ads_measurement'),
              saleOrShare: purposeLabel('sale_or_share'),
              targetedAdvertising: purposeLabel('targeted_advertising'),
            })}
          </p>
          <a href="/privacy">{t['admin.advertising.tracking.privacyCentreLink']()}</a>
        </Stack>
      </Alert>

      <section aria-labelledby="tracking-test-heading">
        <Stack gap="4">
          <h2 id="tracking-test-heading">{t['admin.advertising.tracking.testHeading']()}</h2>
          <p>{t['admin.advertising.tracking.testDescription']()}</p>

          <form
            class="tracking-test-form"
            onsubmit={(event) => {
              event.preventDefault()
              void sendTestEvent()
            }}
          >
            <Stack gap="4">
              <Field label={t['admin.advertising.tracking.testEventNameLabel']()} required>
                {#snippet children(controlProps)}
                  <Input {...controlProps} bind:value={testEventName} required />
                {/snippet}
              </Field>
              <Field label={t['admin.advertising.tracking.testValueLabel']()}>
                {#snippet children(controlProps)}
                  <Input {...controlProps} bind:value={testValue} inputmode="numeric" />
                {/snippet}
              </Field>
              <Field label={t['admin.advertising.tracking.testCurrencyLabel']()}>
                {#snippet children(controlProps)}
                  <Input {...controlProps} bind:value={testCurrency} />
                {/snippet}
              </Field>
              <Field label={t['admin.advertising.tracking.testOrderRefLabel']()}>
                {#snippet children(controlProps)}
                  <Input {...controlProps} bind:value={testOrderRef} />
                {/snippet}
              </Field>
              <div>
                <Button type="submit" variant="primary" disabled={testSending}>
                  {testSending
                    ? t['admin.advertising.tracking.testSendingLabel']()
                    : t['admin.advertising.tracking.testSendLabel']()}
                </Button>
              </div>
            </Stack>
          </form>

          {#if testError}
            <Alert variant="error">{t['admin.advertising.tracking.testError']()}</Alert>
          {/if}

          {#if testResult && testOutcome}
            <div
              class="tracking-test-result"
              role="region"
              aria-labelledby="tracking-test-result-heading"
            >
              <Stack gap="4">
                <h3 id="tracking-test-result-heading">
                  {t['admin.advertising.tracking.resultHeading']()}
                </h3>

                <div>
                  <h4>{t['admin.advertising.tracking.resultCapturedHeading']()}</h4>
                  <dl class="tracking-result-list">
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultEventLabel']()}</dt>
                      <dd>{testResult.captured.name}</dd>
                    </div>
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultValueLabel']()}</dt>
                      <dd>{testValueDisplay}</dd>
                    </div>
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultOrderRefLabel']()}</dt>
                      <dd>{testResult.captured.order_ref ?? NO_VALUE}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4>{t['admin.advertising.tracking.resultDecisionHeading']()}</h4>
                  <p role="status">
                    {testOutcome.suppressed
                      ? t['admin.advertising.tracking.resultDecisionSuppressed']({
                          purpose: purposeLabel(testOutcome.purpose ?? ''),
                          source: humanizeOptionValue(testOutcome.source),
                        })
                      : t['admin.advertising.tracking.resultDecisionPermitted']()}
                  </p>
                  <dl class="tracking-result-list">
                    {#each testResult.captured.consent.purposes_asked as purpose (purpose)}
                      <div class="tracking-result-row">
                        <dt>{purposeLabel(purpose)}</dt>
                        <dd>{answerLabel(testResult.captured.consent.answers[purpose])}</dd>
                      </div>
                    {/each}
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultJurisdictionLabel']()}</dt>
                      <dd>{testResult.captured.consent.jurisdiction}</dd>
                    </div>
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultSignalSourceLabel']()}</dt>
                      <dd>{humanizeOptionValue(testResult.captured.consent.signal_source)}</dd>
                    </div>
                    <div class="tracking-result-row">
                      <dt>{t['admin.advertising.tracking.resultResolverVersionLabel']()}</dt>
                      <dd>{testResult.captured.consent.resolver_version}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4>{t['admin.advertising.tracking.resultClickIdsHeading']()}</h4>
                  {#if clickIdEntries.length === 0}
                    <p>{t['admin.advertising.tracking.resultClickIdsNone']()}</p>
                  {:else}
                    <ul class="tracking-click-ids">
                      {#each clickIdEntries as [name, value] (name)}
                        <li>
                          <span class="tracking-click-id-name">{name}</span> {value}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </Stack>
            </div>
          {/if}
        </Stack>
      </section>

      <div>
        <Button variant="secondary" onclick={() => navigate('/advertising/conversions')}>
          {t['admin.advertising.tracking.conversionsLink']()}
        </Button>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .tracking-matrix-scroll {
    overflow-x: auto;
  }

  .tracking-matrix {
    width: 100%;
    border-collapse: collapse;
  }

  .tracking-matrix th,
  .tracking-matrix td {
    padding: var(--sanvi-spacing-3);
    text-align: left;
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-subtle);
  }

  .tracking-test-form {
    max-width: var(--sanvi-spacing-48);
  }

  .tracking-test-result {
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .tracking-result-list {
    margin: 0;
  }

  .tracking-result-row {
    display: flex;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-1) 0;
  }

  .tracking-result-row dt {
    min-width: var(--sanvi-spacing-32);
    color: var(--sanvi-color-text-secondary);
  }

  .tracking-result-row dd {
    margin: 0;
    color: var(--sanvi-color-text-primary);
  }

  .tracking-click-ids {
    margin: 0;
    padding-left: var(--sanvi-spacing-6);
    font-family: var(--sanvi-font-family-mono);
    font-size: var(--sanvi-font-size-sm);
  }

  .tracking-click-id-name {
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
