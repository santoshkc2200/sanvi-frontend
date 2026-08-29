<script lang="ts">
import { onDestroy } from 'svelte'
import {
  ApiError,
  claimCustomDomain,
  getDomainInstructions,
  listCustomDomains,
  requestDomainVerification,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DomainRecordTable,
  type DomainRecordItem,
  Field,
  Input,
  Select,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import {
  ALL_GUIDES,
  detectRegistrar,
  getGuide,
  type RegistrarId,
} from '../lib/domains/registrar-guides'
import { pollWithBackoff, type Poller } from '../lib/domains/poll'

type CustomDomainView = components['schemas']['CustomDomainView']

interface Props {
  id?: string
}

let { id: propId }: Props = $props()

// Step state: 1: Enter Domain, 2: Add Records, 3: Verifying, 4: Securing, 5: Live
let step = $state<1 | 2 | 3 | 4 | 5>(1)
let rawHostname = $state('')
let domain = $state<CustomDomainView | null>(null)
let selectedRegistrarId = $state<RegistrarId>('generic')

let loading = $state(true)
let submitting = $state(false)
let verifyingNow = $state(false)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let hostnameError = $state<string | undefined>(undefined)

let resumedDomainName = $state<string | undefined>(undefined)
let elapsedTimeSec = $state(0)
let elapsedTimer: ReturnType<typeof setInterval> | undefined

let poller: Poller<CustomDomainView[]> | undefined

const selectedGuide = $derived(getGuide(selectedRegistrarId))

const guideOptions = $derived(
  ALL_GUIDES.map((g) => ({
    value: g.id,
    label: t[g.nameKey as keyof typeof t] ? t[g.nameKey as keyof typeof t]() : g.id,
  })),
)

function normalizeHostname(input: string): string {
  let h = input.trim().toLowerCase()
  h = h.replace(/^https?:\/\//, '')
  h = h.replace(/\/.*$/, '')
  h = h.replace(/\.+$/, '')
  return h
}

function isValidHostname(h: string): boolean {
  if (!h || h.length < 3 || h.length > 253) return false
  const parts = h.split('.')
  if (parts.length < 2) return false
  const domainPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
  return parts.every((part) => domainPattern.test(part))
}

const domainRecords = $derived.by<DomainRecordItem[]>(() => {
  if (!domain) return []
  const items: DomainRecordItem[] = []

  const txtName = domain.challenge?.txt_name || `_sanvi-challenge.${domain.hostname}`
  const txtValue =
    domain.challenge?.txt_value ||
    (domain.challenge?.token
      ? `sanvi-verification=${domain.challenge.token}`
      : `sanvi-verification=${domain.id}`)

  let txtObserved: DomainRecordItem['observed'] = 'pending'
  if (['live', 'verified', 'issuing_cert'].includes(domain.status)) {
    txtObserved = 'matched'
  } else if (
    domain.failure?.code === 'txt_missing' ||
    domain.failure?.code === 'challenge_expired'
  ) {
    txtObserved = 'not_found'
  } else if (domain.failure?.code === 'dns_drift' || domain.failure?.code === 'txt_mismatch') {
    txtObserved = 'mismatch'
  }

  items.push({
    type: 'TXT',
    name: txtName,
    expected: txtValue,
    observed: txtObserved,
  })

  const isSubdomain = domain.hostname.split('.').length > 2
  const routingType = isSubdomain ? 'CNAME' : 'A'
  const routingTarget = isSubdomain ? 'edge.sanvi.app' : '192.0.2.1'

  let routingObserved: DomainRecordItem['observed'] = 'pending'
  if (
    domain.status === 'live' ||
    domain.status === 'verified' ||
    domain.status === 'issuing_cert'
  ) {
    routingObserved = 'matched'
  } else if (domain.failure?.code === 'routing_missing') {
    routingObserved = 'not_found'
  } else if (domain.failure?.code === 'routing_mismatch') {
    routingObserved = 'mismatch'
  }

  items.push({
    type: routingType,
    name: domain.hostname,
    expected: routingTarget,
    observed: routingObserved,
  })

  return items
})

const failureMessage = $derived.by(() => {
  if (!domain?.failure) return undefined
  switch (domain.failure.code) {
    case 'txt_missing':
      return t['admin.domains.failure.txtMissing']()
    case 'txt_mismatch':
      return t['admin.domains.failure.txtMismatch']()
    case 'routing_missing':
      return t['admin.domains.failure.routingMissing']()
    case 'routing_mismatch':
      return t['admin.domains.failure.routingMismatch']()
    case 'dns_drift':
      return t['admin.domains.failure.dnsDrift']()
    case 'challenge_expired':
      return t['admin.domains.failure.challengeExpired']()
    case 'verified_by_other_tenant':
      return t['admin.domains.failure.verifiedByOtherTenant']()
    case 'cert_invalid':
      return t['admin.domains.failure.certInvalid']()
    case 'propagating':
      return t['admin.domains.failure.propagating']()
    default:
      return t['admin.domains.failure.generic']()
  }
})

function deriveStepFromDomain(d: CustomDomainView): 1 | 2 | 3 | 4 | 5 {
  switch (d.status) {
    case 'pending_setup':
      return 2
    case 'verifying':
      return 3
    case 'verified':
      return 4
    case 'issuing_cert':
      return 4
    case 'live':
      return 5
    case 'degraded':
      return 3
    default:
      return 2
  }
}

function startElapsedTimer(): void {
  if (elapsedTimer) clearInterval(elapsedTimer)
  elapsedTimeSec = 0
  elapsedTimer = setInterval(() => {
    elapsedTimeSec += 1
  }, 1000)
}

function stopElapsedTimer(): void {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = undefined
  }
}

function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function syncPolledDomain(list: CustomDomainView[]): void {
  if (!domain) return
  const current = list.find((d) => d.id === domain?.id || d.hostname === domain?.hostname)
  if (!current) return

  domain = current
  const targetStep = deriveStepFromDomain(current)
  if (targetStep > step) {
    step = targetStep
  }
}

function startPolling(): void {
  if (poller) poller.stop()

  poller = pollWithBackoff(
    async (signal) => {
      const list = await listCustomDomains(apiClient, signal)
      return list ?? []
    },
    (list) => {
      if (!domain) return true
      const current = list.find((d) => d.id === domain?.id || d.hostname === domain?.hostname)
      if (!current) return false
      return current.status === 'live' || current.status === 'removed'
    },
    {
      minDelayMs: 2000,
      maxDelayMs: 20000,
      backoffFactor: 1.5,
      onUpdate: (list) => {
        syncPolledDomain(list)
      },
    },
  )
  poller.start()
}

async function handleCheckNow(): Promise<void> {
  if (!domain) return
  verifyingNow = true
  try {
    await requestDomainVerification(apiClient, domain.id)
    if (poller) {
      await poller.checkNow()
    } else {
      const list = await listCustomDomains(apiClient)
      syncPolledDomain(list ?? [])
    }
  } catch {
    // Polling will continue automatically
  } finally {
    verifyingNow = false
  }
}

async function init(): Promise<void> {
  loading = true
  error = undefined
  entitled = true

  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const targetId = propId || urlParams?.get('id') || urlParams?.get('domain')

  try {
    const list = await listCustomDomains(apiClient)
    if (targetId) {
      const found = (list ?? []).find((d) => d.id === targetId || d.hostname === targetId)
      if (found) {
        domain = found
        rawHostname = found.hostname
        resumedDomainName = found.hostname
        const detected = detectRegistrar(found.detected_registrar)
        selectedRegistrarId = detected === 'unknown' ? 'generic' : detected
        step = deriveStepFromDomain(found)

        if (step === 3 || step === 4) {
          startElapsedTimer()
          startPolling()
        }
      }
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.domains.genericError']()
    }
  } finally {
    loading = false
  }
}

$effect(() => {
  void getActiveTenantId()
  void init()
})

$effect(() => {
  if (step === 3 || step === 4) {
    if (!elapsedTimer) startElapsedTimer()
    if (!poller || !poller.isRunning()) startPolling()
  } else if (step === 5) {
    stopElapsedTimer()
    if (poller) poller.stop()
  }
})

onDestroy(() => {
  stopElapsedTimer()
  if (poller) poller.stop()
})

async function handleClaimSubmit(e?: Event): Promise<void> {
  e?.preventDefault()
  hostnameError = undefined
  error = undefined

  const normalized = normalizeHostname(rawHostname)
  if (!isValidHostname(normalized)) {
    hostnameError = t['admin.domains.connect.invalidHostname']()
    return
  }

  submitting = true
  try {
    const res = await claimCustomDomain(apiClient, normalized, 'primary')
    if (res) {
      domain = res
      const detected = detectRegistrar(res.detected_registrar)
      selectedRegistrarId = detected === 'unknown' ? 'generic' : detected
      step = 2

      if (typeof window !== 'undefined' && window.history) {
        const url = new URL(window.location.href)
        url.searchParams.set('id', res.id)
        window.history.replaceState({}, '', url.toString())
      }
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        entitled = false
      } else if (err.status === 400) {
        hostnameError = t['admin.domains.connect.invalidHostname']()
      } else {
        error = t['admin.domains.genericError']()
      }
    } else {
      error = t['admin.domains.genericError']()
    }
  } finally {
    submitting = false
  }
}

function handleAddedRecords(): void {
  if (!domain) return
  void requestDomainVerification(apiClient, domain.id).catch(() => {})
  step = 3
  startElapsedTimer()
  startPolling()
}
</script>

<svelte:head>
  <title>{t['admin.domains.connect.title']()}</title>
</svelte:head>

<Container size="md" padding="6">
  <Stack gap="6">
    <div>
      <a class="sanvi-connect__back-link" href="/domains">
        ← {t['admin.domains.connect.backLink']()}
      </a>
    </div>

    <div class="sanvi-connect__header">
      <h1>{t['admin.domains.connect.title']()}</h1>
      <p class="sanvi-connect__subtitle">{t['admin.domains.connect.description']()}</p>
    </div>

    {#if resumedDomainName}
      <Alert variant="info">
        {t['admin.domains.connect.resumedNotice']({ hostname: resumedDomainName })}
      </Alert>
    {/if}

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.domains.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        feature="domains.custom"
        title={t['admin.domains.upgradeTitle']()}
        description={t['admin.domains.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      <!-- 5-Step Stepper Navigation -->
      <nav class="sanvi-connect-stepper" aria-label={t['admin.domains.connect.wizardStepsAriaLabel']()}>
        <ol class="sanvi-connect-stepper__list">
          <li
            class="sanvi-connect-stepper__item"
            class:sanvi-connect-stepper__item--active={step === 1}
            class:sanvi-connect-stepper__item--complete={step > 1}
          >
            <span class="sanvi-connect-stepper__num">1</span>
            <span class="sanvi-connect-stepper__label">{t['admin.domains.connect.step1Nav']()}</span>
          </li>
          <li
            class="sanvi-connect-stepper__item"
            class:sanvi-connect-stepper__item--active={step === 2}
            class:sanvi-connect-stepper__item--complete={step > 2}
          >
            <span class="sanvi-connect-stepper__num">2</span>
            <span class="sanvi-connect-stepper__label">{t['admin.domains.connect.step2Nav']()}</span>
          </li>
          <li
            class="sanvi-connect-stepper__item"
            class:sanvi-connect-stepper__item--active={step === 3}
            class:sanvi-connect-stepper__item--complete={step > 3}
          >
            <span class="sanvi-connect-stepper__num">3</span>
            <span class="sanvi-connect-stepper__label">{t['admin.domains.connect.step3Nav']()}</span>
          </li>
          <li
            class="sanvi-connect-stepper__item"
            class:sanvi-connect-stepper__item--active={step === 4}
            class:sanvi-connect-stepper__item--complete={step > 4}
          >
            <span class="sanvi-connect-stepper__num">4</span>
            <span class="sanvi-connect-stepper__label">{t['admin.domains.connect.step4Nav']()}</span>
          </li>
          <li
            class="sanvi-connect-stepper__item"
            class:sanvi-connect-stepper__item--active={step === 5}
            class:sanvi-connect-stepper__item--complete={step === 5}
          >
            <span class="sanvi-connect-stepper__num">5</span>
            <span class="sanvi-connect-stepper__label">{t['admin.domains.connect.step5Nav']()}</span>
          </li>
        </ol>
      </nav>

      <!-- Step 1: Enter Domain -->
      {#if step === 1}
        <div class="sanvi-connect__card">
          <form onsubmit={handleClaimSubmit}>
            <Stack gap="5">
              <div>
                <h2>{t['admin.domains.connect.step1Title']()}</h2>
                <p class="sanvi-connect__card-desc">{t['admin.domains.connect.step1Description']()}</p>
              </div>

              <Field
                label={t['admin.domains.connect.hostnameLabel']()}
                hint={t['admin.domains.connect.hostnameHint']()}
                error={hostnameError}
                required
              >
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={rawHostname}
                    placeholder={t['admin.domains.connect.hostnamePlaceholder']()}
                    disabled={submitting}
                  />
                {/snippet}
              </Field>

              <div class="sanvi-connect__explanation">
                <p>{t['admin.domains.connect.apexExplanation']()}</p>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                loadingLabel={t['admin.domains.connect.claiming']()}
                disabled={!rawHostname.trim()}
              >
                {t['admin.domains.connect.submitStep1']()}
              </Button>
            </Stack>
          </form>
        </div>

      <!-- Step 2: Add Records -->
      {:else if step === 2 && domain}
        <div class="sanvi-connect__card">
          <Stack gap="5">
            <div>
              <h2>{t['admin.domains.connect.step2Title']()}</h2>
              <p class="sanvi-connect__card-desc">{t['admin.domains.connect.step2Description']()}</p>
            </div>

            <!-- DNS Records Table with Copy affordance -->
            <DomainRecordTable
              records={domainRecords}
              typeHeader={t['admin.domains.detail.recordsTypeHeader']()}
              nameHeader={t['admin.domains.detail.recordsNameHeader']()}
              expectedHeader={t['admin.domains.detail.recordsValueHeader']()}
              statusHeader={t['admin.domains.detail.recordsStatusHeader']()}
              actionsHeader={t['admin.domains.detail.recordsActionsHeader']()}
              copyLabel={t['admin.domains.detail.copy']()}
              copiedLabel={t['admin.domains.detail.copied']()}
              copyAllLabel={t['admin.domains.detail.copyAll']()}
              copyAllCopiedLabel={t['admin.domains.detail.copyAllCopied']()}
              emptyMessage={t['admin.domains.detail.noRecords']()}
              statusMatchedLabel={t['admin.domains.detail.recordMatched']()}
              statusPendingLabel={t['admin.domains.detail.recordPending']()}
              statusMismatchLabel={t['admin.domains.detail.recordMismatch']()}
              statusNotFoundLabel={t['admin.domains.detail.recordNotFound']()}
            />

            <!-- Registrar Guide Selection & Steps -->
            <section class="sanvi-connect__guide-section" aria-label={t['admin.domains.connect.guideSectionAriaLabel']()}>
              <Cluster justify="space-between" align="center" gap="4">
                <h3>{t['admin.domains.connect.instructionsTitle']({ registrar: selectedGuide.id })}</h3>
                <div class="sanvi-connect__guide-select">
                  <Field label={t['admin.domains.connect.selectGuideLabel']()}>
                    {#snippet children(controlProps)}
                      <Select
                        {...controlProps}
                        options={guideOptions}
                        bind:value={selectedRegistrarId}
                      />
                    {/snippet}
                  </Field>
                </div>
              </Cluster>

              <ol class="sanvi-connect__guide-steps">
                {#each selectedGuide.steps as gStep, idx}
                  <li class="sanvi-connect__guide-step">
                    <span class="sanvi-connect__guide-step-num">{idx + 1}</span>
                    <p class="sanvi-connect__guide-step-text">
                      {t[gStep.textKey as keyof typeof t] ? t[gStep.textKey as keyof typeof t]() : gStep.textKey}
                    </p>
                  </li>
                {/each}
              </ol>
            </section>

            <!-- Security Notice -->
            <div class="sanvi-connect__security-callout">
              <strong>{t['admin.domains.detail.securityNoticeTitle']()}</strong>
              <p>{t['admin.domains.connect.securityNotice']()}</p>
            </div>

            <div class="sanvi-connect__auto-note">
              <p>{t['admin.domains.connect.verificationStartedNote']()}</p>
            </div>

            <Button
              variant="primary"
              onclick={handleAddedRecords}
            >
              {t['admin.domains.connect.addedRecordsButton']()}
            </Button>
          </Stack>
        </div>

      <!-- Step 3: Verifying DNS -->
      {:else if step === 3 && domain}
        <div class="sanvi-connect__card">
          <Stack gap="5">
            <div class="sanvi-connect__status-header" aria-live="polite">
              <h2>{t['admin.domains.connect.step3Title']()}</h2>
              <p class="sanvi-connect__card-desc">{t['admin.domains.connect.step3Description']()}</p>
            </div>

            {#if failureMessage}
              <Alert variant="warning">
                <strong>{t['admin.domains.healthDegraded']()}</strong>
                <p>{failureMessage}</p>
              </Alert>
            {/if}

            <DomainRecordTable
              records={domainRecords}
              typeHeader={t['admin.domains.detail.recordsTypeHeader']()}
              nameHeader={t['admin.domains.detail.recordsNameHeader']()}
              expectedHeader={t['admin.domains.detail.recordsValueHeader']()}
              statusHeader={t['admin.domains.detail.recordsStatusHeader']()}
              actionsHeader={t['admin.domains.detail.recordsActionsHeader']()}
              copyLabel={t['admin.domains.detail.copy']()}
              copiedLabel={t['admin.domains.detail.copied']()}
              copyAllLabel={t['admin.domains.detail.copyAll']()}
              copyAllCopiedLabel={t['admin.domains.detail.copyAllCopied']()}
              emptyMessage={t['admin.domains.detail.noRecords']()}
              statusMatchedLabel={t['admin.domains.detail.recordMatched']()}
              statusPendingLabel={t['admin.domains.detail.recordPending']()}
              statusMismatchLabel={t['admin.domains.detail.recordMismatch']()}
              statusNotFoundLabel={t['admin.domains.detail.recordNotFound']()}
            />

            <div class="sanvi-connect__meta-panel">
              <Cluster justify="space-between" align="center" gap="4">
                <span class="sanvi-connect__elapsed">
                  {t['admin.domains.connect.elapsedTime']({ time: formatElapsedTime(elapsedTimeSec) })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={verifyingNow}
                  loadingLabel={t['admin.domains.connect.checking']()}
                  onclick={handleCheckNow}
                >
                  {t['admin.domains.connect.checkNowButton']()}
                </Button>
              </Cluster>
            </div>

            <div class="sanvi-connect__leave-panel">
              <p>{t['admin.domains.connect.leaveNotice']()}</p>
            </div>
          </Stack>
        </div>

      <!-- Step 4: Securing (Issuing TLS Certificate) -->
      {:else if step === 4 && domain}
        <div class="sanvi-connect__card">
          <Stack gap="5" align="center">
            <div class="sanvi-connect__status-header" aria-live="polite">
              <h2>{t['admin.domains.connect.step4Title']()}</h2>
              <p class="sanvi-connect__card-desc">{t['admin.domains.connect.step4Description']()}</p>
            </div>

            <div class="sanvi-connect__spinner-box">
              <Spinner size="md" label={t['admin.domains.connect.issuingStatus']()} />
              <p>{t['admin.domains.connect.issuingStatus']()}</p>
            </div>

            <div class="sanvi-connect__leave-panel">
              <p>{t['admin.domains.connect.leaveNotice']()}</p>
            </div>
          </Stack>
        </div>

      <!-- Step 5: Live -->
      {:else if step === 5 && domain}
        <div class="sanvi-connect__card">
          <Stack gap="5">
            <div class="sanvi-connect__live-header" aria-live="polite">
              <Badge variant="success">
                {#snippet children()}
                  {t['admin.domains.statusLive']()}
                {/snippet}
              </Badge>
              <h2>{t['admin.domains.connect.step5Title']()}</h2>
              <p class="sanvi-connect__card-desc">{t['admin.domains.connect.step5Description']()}</p>
              <p class="sanvi-connect__live-url">
                {t['admin.domains.connect.liveUrlLabel']({ url: `https://${domain.hostname}` })}
              </p>
            </div>

            <div class="sanvi-connect__next-steps">
              <h3>{t['admin.domains.connect.nextStepsTitle']()}</h3>
              <ul>
                <li>{t['admin.domains.connect.nextStepPrimary']()}</li>
              </ul>
            </div>

            <Cluster gap="3">
              <a
                class="sanvi-connect__action-link"
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="primary">
                  {t['admin.domains.connect.visitStorefront']()}
                </Button>
              </a>
              <a class="sanvi-connect__action-link" href={`/domains/${domain.id}`}>
                <Button variant="secondary">
                  {t['admin.domains.connect.viewDetails']()}
                </Button>
              </a>
            </Cluster>
          </Stack>
        </div>
      {/if}

      <div class="sanvi-connect__footer-help">
        <p>{t['admin.domains.connect.needHelp']()}</p>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-connect__back-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-connect__back-link:hover {
    text-decoration: underline;
  }

  .sanvi-connect__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-connect__subtitle {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  /* Stepper */
  .sanvi-connect-stepper {
    width: 100%;
    overflow-x: auto;
  }

  .sanvi-connect-stepper__list {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-connect-stepper__item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
    white-space: nowrap;
  }

  .sanvi-connect-stepper__num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-5);
    height: var(--sanvi-spacing-5);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-bold);
    flex-shrink: 0;
  }

  .sanvi-connect-stepper__item--active {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-connect-stepper__item--active .sanvi-connect-stepper__num {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-connect-stepper__item--complete {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-connect-stepper__item--complete .sanvi-connect-stepper__num {
    background: var(--sanvi-color-solid-success-base);
    color: var(--sanvi-color-text-inverse);
  }

  /* Card */
  .sanvi-connect__card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-connect__card h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-connect__card-desc {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__explanation {
    padding: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__explanation p {
    margin: 0;
  }

  /* Guide section */
  .sanvi-connect__guide-section {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-connect__guide-section h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-connect__guide-select {
    min-width: var(--sanvi-spacing-48);
  }

  .sanvi-connect__guide-steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-connect__guide-step {
    display: flex;
    align-items: flex-start;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-connect__guide-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-5);
    height: var(--sanvi-spacing-5);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-semibold);
    flex-shrink: 0;
    margin-block-start: var(--sanvi-spacing-1);
  }

  .sanvi-connect__guide-step-text {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-connect__security-callout {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-solid-primary-base);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__security-callout strong {
    color: var(--sanvi-color-text-primary);
    display: block;
    margin-block-end: var(--sanvi-spacing-1);
  }

  .sanvi-connect__security-callout p {
    margin: 0;
  }

  .sanvi-connect__auto-note {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__auto-note p {
    margin: 0;
  }

  .sanvi-connect__status-header {
    text-align: center;
  }

  .sanvi-connect__meta-panel {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-connect__elapsed {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-connect__leave-panel {
    text-align: center;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__spinner-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-8);
  }

  .sanvi-connect__spinner-box p {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-connect__live-header {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    align-items: flex-start;
  }

  .sanvi-connect__live-url {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-solid-success-base);
  }

  .sanvi-connect__next-steps {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-connect__next-steps h3 {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-connect__next-steps ul {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-4);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__action-link {
    text-decoration: none;
  }

  .sanvi-connect__footer-help {
    text-align: center;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-connect__footer-help p {
    margin: 0;
  }
</style>
