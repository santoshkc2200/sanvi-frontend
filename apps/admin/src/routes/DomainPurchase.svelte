<script lang="ts">
import { onDestroy } from 'svelte'
import {
  ApiError,
  listCustomDomains,
  listDomainOrders,
  placeDomainOrder,
  searchDomains,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Cluster,
  Container,
  Field,
  Input,
  Select,
  Spinner,
  Stack,
  UpgradePrompt,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'
import { pollWithBackoff, type Poller } from '../lib/domains/poll'

type CustomDomainView = components['schemas']['CustomDomainView']
type DomainQuote = components['schemas']['DomainQuote']
type OrderView = components['schemas']['OrderView']
type RegistrantContact = components['schemas']['RegistrantContact']

interface Props {
  orderId?: string
  id?: string
}

let { orderId: propOrderId, id: propId }: Props = $props()

// Step state: 1: Search, 2: Options, 3: Registrant, 4: Review & Pay, 5: Provisioning, 6: Live
let step = $state<1 | 2 | 3 | 4 | 5 | 6>(1)

let loading = $state(true)
let submitting = $state(false)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let resumedHostname = $state<string | undefined>(undefined)

// Step 1: Search State
let searchQuery = $state('')
let searchStatus = $state<'idle' | 'searching' | 'success' | 'empty' | 'error'>('idle')
let searchResults = $state<DomainQuote[]>([])
let selectedQuote = $state<DomainQuote | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0
let searchAbortController: AbortController | undefined

// Step 2: Options State
let termYears = $state(1)
let autoRenew = $state(true)
let whoisPrivacy = $state(true)

// Step 3: Registrant Contact Form State
let registrantName = $state('')
let registrantOrg = $state('')
let registrantEmail = $state('')
let registrantPhone = $state('')
let registrantCountry = $state('US')
let registrantError = $state<string | undefined>(undefined)

// Step 5: Provisioning State
let currentOrder = $state<OrderView | null>(null)
let domain = $state<CustomDomainView | null>(null)
let orderPoller: Poller<OrderView[]> | undefined
let domainPoller: Poller<CustomDomainView[]> | undefined
let elapsedTimeSec = $state(0)
let elapsedTimer: ReturnType<typeof setInterval> | undefined

const COUNTRY_OPTIONS = $derived([
  { value: 'US', label: t['admin.domains.purchase.countryUS']() },
  { value: 'JP', label: t['admin.domains.purchase.countryJP']() },
  { value: 'GB', label: t['admin.domains.purchase.countryGB']() },
  { value: 'CA', label: t['admin.domains.purchase.countryCA']() },
  { value: 'AU', label: t['admin.domains.purchase.countryAU']() },
  { value: 'DE', label: t['admin.domains.purchase.countryDE']() },
  { value: 'FR', label: t['admin.domains.purchase.countryFR']() },
  { value: 'SG', label: t['admin.domains.purchase.countrySG']() },
  { value: 'NZ', label: t['admin.domains.purchase.countryNZ']() },
  { value: 'NL', label: t['admin.domains.purchase.countryNL']() },
])

const TERM_OPTIONS = $derived([
  { value: '1', label: t['admin.domains.purchase.termYear1']() },
  { value: '2', label: t['admin.domains.purchase.termYear2']() },
  { value: '3', label: t['admin.domains.purchase.termYear3']() },
  { value: '5', label: t['admin.domains.purchase.termYear5']() },
])

const totalTodayFormatted = $derived.by(() => {
  if (!selectedQuote) return ''
  // The backend's registrar port quotes and charges `register_price` as a flat
  // one-time amount — it does not scale with `term_years` (see
  // SandboxRegistrar::quote in the backend's domains context, which ignores
  // the term_years argument entirely). Multiplying by termYears here would
  // show the tenant a total larger than what actually gets charged.
  return fmt.money(selectedQuote.register_price.amount_minor, selectedQuote.register_price.currency)
})

const renewPriceFormatted = $derived.by(() => {
  if (!selectedQuote) return ''
  return fmt.money(selectedQuote.renew_price.amount_minor, selectedQuote.renew_price.currency)
})

const provisioningStatusText = $derived.by(() => {
  if (currentOrder) {
    switch (currentOrder.status) {
      case 'pending':
      case 'charged':
        return t['admin.domains.purchase.statusPayment']()
      case 'registered':
        return t['admin.domains.purchase.statusRegistering']()
      case 'configuring':
        return t['admin.domains.purchase.statusConfiguring']()
      case 'active': {
        if (!domain) return t['admin.domains.purchase.statusConfiguring']()
        switch (domain.status) {
          case 'pending_setup':
          case 'verifying':
            return t['admin.domains.purchase.statusVerifying']()
          case 'verified':
          case 'issuing_cert':
            return t['admin.domains.purchase.statusSecuring']()
          case 'live':
            return ''
          default:
            return t['admin.domains.purchase.statusVerifying']()
        }
      }
    }
  }
  return t['admin.domains.purchase.statusConfiguring']()
})

function triggerSearch(candidate: string): void {
  if (searchTimer) clearTimeout(searchTimer)
  if (searchAbortController) {
    searchAbortController.abort()
    searchAbortController = undefined
  }
  const trimmed = candidate.trim()
  if (!trimmed || trimmed.length < 2) {
    searchStatus = 'idle'
    searchResults = []
    return
  }

  const seq = ++searchSeq
  searchStatus = 'searching'

  searchTimer = setTimeout(async () => {
    const controller = new AbortController()
    searchAbortController = controller
    try {
      const res = await searchDomains(apiClient, trimmed, controller.signal)
      if (seq !== searchSeq) return
      const quotes = res?.results ?? []
      searchResults = quotes
      if (quotes.length === 0) {
        searchStatus = 'empty'
      } else {
        searchStatus = 'success'
      }
    } catch {
      if (seq !== searchSeq) return
      searchStatus = 'error'
      searchResults = []
    } finally {
      if (searchAbortController === controller) {
        searchAbortController = undefined
      }
    }
  }, 400)
}

function handleSearchInput(e: Event): void {
  const val = (e.target as HTMLInputElement).value
  searchQuery = val
  triggerSearch(val)
}

function handleSearchSubmit(e?: Event): void {
  e?.preventDefault()
  if (searchQuery.trim()) {
    triggerSearch(searchQuery)
  }
}

function selectQuote(quote: DomainQuote): void {
  if (!quote.available) return
  selectedQuote = quote
}

function proceedToOptions(): void {
  if (!selectedQuote) return
  step = 2
}

function proceedToRegistrant(): void {
  step = 3
}

function validateRegistrant(): boolean {
  registrantError = undefined
  if (
    !registrantName.trim() ||
    !registrantEmail.trim() ||
    !registrantPhone.trim() ||
    !registrantCountry.trim()
  ) {
    registrantError = t['admin.domains.purchase.requiredFieldsError']()
    return false
  }
  if (!registrantEmail.includes('@') || !registrantEmail.includes('.')) {
    registrantError = t['admin.domains.purchase.invalidEmail']()
    return false
  }
  return true
}

function proceedToReview(): void {
  if (!validateRegistrant()) return
  step = 4
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

function startOrderPolling(): void {
  if (orderPoller) orderPoller.stop()

  orderPoller = pollWithBackoff(
    async (signal) => {
      const orders = await listDomainOrders(apiClient, signal)
      return orders ?? []
    },
    (orders) => {
      if (!currentOrder) return true
      const match = orders.find(
        (o) => o.id === currentOrder?.id || o.hostname === currentOrder?.hostname,
      )
      if (!match) return false
      return match.status === 'active' || match.status === 'failed' || match.status === 'refunded'
    },
    {
      minDelayMs: 2000,
      maxDelayMs: 20000,
      backoffFactor: 1.5,
      onUpdate: (orders) => {
        if (!currentOrder) return
        const match = orders.find(
          (o) => o.id === currentOrder?.id || o.hostname === currentOrder?.hostname,
        )
        if (match) {
          currentOrder = match
          if (match.status === 'active') {
            startDomainPolling()
          }
        }
      },
    },
  )
  orderPoller.start()
}

function startDomainPolling(): void {
  if (domainPoller) domainPoller.stop()

  domainPoller = pollWithBackoff(
    async (signal) => {
      const domains = await listCustomDomains(apiClient, signal)
      return domains ?? []
    },
    (domains) => {
      const targetHostname = currentOrder?.hostname || domain?.hostname
      if (!targetHostname) return true
      const match = domains.find((d) => d.hostname === targetHostname || d.id === domain?.id)
      if (!match) return false
      return match.status === 'live' || match.status === 'removed'
    },
    {
      minDelayMs: 2000,
      maxDelayMs: 20000,
      backoffFactor: 1.5,
      onUpdate: (domains) => {
        const targetHostname = currentOrder?.hostname || domain?.hostname
        if (!targetHostname) return
        const match = domains.find((d) => d.hostname === targetHostname || d.id === domain?.id)
        if (match) {
          domain = match
          if (match.status === 'live') {
            step = 6
          }
        }
      },
    },
  )
  domainPoller.start()
}

async function handlePlaceOrder(): Promise<void> {
  if (!selectedQuote) return

  submitting = true
  error = undefined

  try {
    const order = await placeDomainOrder(apiClient, {
      hostname: selectedQuote.hostname,
      term_years: termYears,
      auto_renew: autoRenew,
      whois_privacy: whoisPrivacy,
      registrant_contact: {
        name: registrantName.trim(),
        organization: registrantOrg.trim() || null,
        email: registrantEmail.trim(),
        phone: registrantPhone.trim(),
        country_code: registrantCountry.trim(),
      },
    })

    if (order) {
      currentOrder = order
      step = 5

      if (typeof window !== 'undefined' && window.history) {
        const url = new URL(window.location.href)
        url.searchParams.set('order_id', order.id)
        window.history.replaceState({}, '', url.toString())
      }

      startElapsedTimer()
      if (order.status === 'active') {
        startDomainPolling()
      } else {
        startOrderPolling()
      }
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        entitled = false
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

function handleResetToSearch(): void {
  selectedQuote = null
  currentOrder = null
  domain = null
  step = 1
  if (orderPoller) orderPoller.stop()
  if (domainPoller) domainPoller.stop()
  stopElapsedTimer()
}

async function init(): Promise<void> {
  loading = true
  error = undefined
  entitled = true

  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const targetOrderId = propOrderId || urlParams?.get('order_id') || urlParams?.get('id')
  const targetDomainName = urlParams?.get('domain') || urlParams?.get('hostname')

  try {
    const customDomains = await listCustomDomains(apiClient)
    if (targetOrderId || targetDomainName) {
      const orders = await listDomainOrders(apiClient)
      const foundOrder = (orders ?? []).find(
        (o) =>
          (targetOrderId && (o.id === targetOrderId || o.hostname === targetOrderId)) ||
          (targetDomainName && o.hostname === targetDomainName),
      )

      if (foundOrder) {
        currentOrder = foundOrder
        resumedHostname = foundOrder.hostname

        if (['pending', 'charged', 'registered', 'configuring'].includes(foundOrder.status)) {
          step = 5
          startElapsedTimer()
          startOrderPolling()
          loading = false
          return
        }

        if (foundOrder.status === 'failed' || foundOrder.status === 'refunded') {
          step = 5
          loading = false
          return
        }

        if (foundOrder.status === 'active') {
          const foundDomain = (customDomains ?? []).find(
            (d) => d.hostname === foundOrder.hostname || d.id === foundOrder.id,
          )
          if (foundDomain) {
            domain = foundDomain
            if (foundDomain.status === 'live') {
              step = 6
            } else {
              step = 5
              startElapsedTimer()
              startDomainPolling()
            }
          } else {
            step = 5
            startElapsedTimer()
            startDomainPolling()
          }
          loading = false
          return
        }
      }

      // Check custom domains list directly if no matching order found
      const foundDomain = (customDomains ?? []).find(
        (d) =>
          (targetOrderId && (d.id === targetOrderId || d.hostname === targetOrderId)) ||
          (targetDomainName && d.hostname === targetDomainName),
      )
      if (foundDomain) {
        domain = foundDomain
        resumedHostname = foundDomain.hostname
        if (foundDomain.status === 'live') {
          step = 6
        } else {
          step = 5
          startElapsedTimer()
          startDomainPolling()
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
  if (step === 6) {
    stopElapsedTimer()
    if (orderPoller) orderPoller.stop()
    if (domainPoller) domainPoller.stop()
  }
})

onDestroy(() => {
  stopElapsedTimer()
  if (orderPoller) orderPoller.stop()
  if (domainPoller) domainPoller.stop()
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<svelte:head>
  <title>{t['admin.domains.purchase.title']()}</title>
</svelte:head>

<Container size="md" padding="6">
  <Stack gap="6">
    <div>
      <a class="sanvi-purchase__back-link" href="/domains">
        ← {t['admin.domains.purchase.backLink']()}
      </a>
    </div>

    <div class="sanvi-purchase__header">
      <h1>{t['admin.domains.purchase.title']()}</h1>
      <p class="sanvi-purchase__subtitle">{t['admin.domains.purchase.description']()}</p>
    </div>

    {#if resumedHostname}
      <Alert variant="info">
        {t['admin.domains.purchase.resumedNotice']({ hostname: resumedHostname })}
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
      <!-- 6-Step Stepper Navigation -->
      <nav class="sanvi-purchase-stepper" aria-label={t['admin.domains.purchase.wizardStepsAriaLabel']()}>
        <ol class="sanvi-purchase-stepper__list">
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 1}
            class:sanvi-purchase-stepper__item--complete={step > 1}
          >
            <span class="sanvi-purchase-stepper__num">1</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step1Nav']()}</span>
          </li>
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 2}
            class:sanvi-purchase-stepper__item--complete={step > 2}
          >
            <span class="sanvi-purchase-stepper__num">2</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step2Nav']()}</span>
          </li>
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 3}
            class:sanvi-purchase-stepper__item--complete={step > 3}
          >
            <span class="sanvi-purchase-stepper__num">3</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step3Nav']()}</span>
          </li>
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 4}
            class:sanvi-purchase-stepper__item--complete={step > 4}
          >
            <span class="sanvi-purchase-stepper__num">4</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step4Nav']()}</span>
          </li>
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 5}
            class:sanvi-purchase-stepper__item--complete={step > 5}
          >
            <span class="sanvi-purchase-stepper__num">5</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step5Nav']()}</span>
          </li>
          <li
            class="sanvi-purchase-stepper__item"
            class:sanvi-purchase-stepper__item--active={step === 6}
            class:sanvi-purchase-stepper__item--complete={step === 6}
          >
            <span class="sanvi-purchase-stepper__num">6</span>
            <span class="sanvi-purchase-stepper__label">{t['admin.domains.purchase.step6Nav']()}</span>
          </li>
        </ol>
      </nav>

      <!-- Step 1: Search -->
      {#if step === 1}
        <div class="sanvi-purchase__card">
          <Stack gap="5">
            <div>
              <h2>{t['admin.domains.purchase.step1Title']()}</h2>
              <p class="sanvi-purchase__card-desc">{t['admin.domains.purchase.step1Description']()}</p>
            </div>

            <form onsubmit={handleSearchSubmit}>
              <Cluster gap="3" align="end">
                <div class="sanvi-purchase__search-input-wrap">
                  <Field label={t['admin.domains.purchase.searchLabel']()} required>
                    {#snippet children(controlProps)}
                      <Input
                        {...controlProps}
                        type="search"
                        bind:value={searchQuery}
                        placeholder={t['admin.domains.purchase.searchPlaceholder']()}
                        oninput={handleSearchInput}
                      />
                    {/snippet}
                  </Field>
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!searchQuery.trim()}
                >
                  {t['admin.domains.purchase.searchButton']()}
                </Button>
              </Cluster>
            </form>

            {#if searchStatus === 'searching'}
              <div class="sanvi-purchase__search-loading">
                <Spinner label={t['admin.domains.purchase.searching']()} />
                <p>{t['admin.domains.purchase.searching']()}</p>
              </div>
            {:else if searchStatus === 'empty'}
              <div class="sanvi-purchase__empty-search">
                <p>{t['admin.domains.purchase.noResults']()}</p>
              </div>
            {:else if searchStatus === 'error'}
              <Alert variant="error">
                {t['admin.domains.purchase.searchError']()}
              </Alert>
            {:else if searchStatus === 'success' && searchResults.length > 0}
              <div class="sanvi-purchase__results-list" role="region" aria-label={t['admin.domains.purchase.searchLabel']()}>
                {#each searchResults as quote (quote.hostname)}
                  {@const isSelected = selectedQuote?.hostname === quote.hostname}
                  <div
                    class="sanvi-quote-card"
                    class:sanvi-quote-card--selected={isSelected}
                    class:sanvi-quote-card--unavailable={!quote.available}
                  >
                    <Cluster justify="space-between" align="center" gap="4">
                      <Stack gap="1" align="start">
                        <Cluster gap="2" align="center">
                          <strong class="sanvi-quote-card__hostname">{quote.hostname}</strong>
                          {#if quote.available}
                            <Badge variant="success">
                              {#snippet children()}
                                {t['admin.domains.purchase.availableBadge']()}
                              {/snippet}
                            </Badge>
                          {:else}
                            <Badge variant="neutral">
                              {#snippet children()}
                                {t['admin.domains.purchase.unavailableBadge']()}
                              {/snippet}
                            </Badge>
                          {/if}
                          {#if quote.premium}
                            <Badge variant="info">
                              {#snippet children()}
                                {t['admin.domains.purchase.premiumBadge']()}
                              {/snippet}
                            </Badge>
                          {/if}
                        </Cluster>
                        {#if quote.available}
                          <div class="sanvi-quote-card__pricing">
                            <span class="sanvi-quote-card__register-price">
                              {t['admin.domains.purchase.firstYearPrice']({
                                price: fmt.money(quote.register_price.amount_minor, quote.register_price.currency),
                              })}
                            </span>
                            <span class="sanvi-quote-card__renew-price">
                              • {t['admin.domains.purchase.renewPrice']({
                                price: fmt.money(quote.renew_price.amount_minor, quote.renew_price.currency),
                              })}
                            </span>
                          </div>
                        {/if}
                      </Stack>

                      <div>
                        {#if quote.available}
                          <Button
                            variant={isSelected ? 'primary' : 'secondary'}
                            size="sm"
                            onclick={() => selectQuote(quote)}
                          >
                            {isSelected
                              ? t['admin.domains.purchase.selectedButton']()
                              : t['admin.domains.purchase.selectButton']()}
                          </Button>
                        {:else}
                          <Button variant="secondary" size="sm" disabled>
                            {t['admin.domains.purchase.unavailableBadge']()}
                          </Button>
                        {/if}
                      </div>
                    </Cluster>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="sanvi-purchase__actions">
              <Button
                variant="primary"
                disabled={!selectedQuote}
                onclick={proceedToOptions}
              >
                {t['admin.domains.purchase.continueToOptions']()}
              </Button>
            </div>
          </Stack>
        </div>

      <!-- Step 2: Options -->
      {:else if step === 2 && selectedQuote}
        <div class="sanvi-purchase__card">
          <Stack gap="5">
            <div class="sanvi-purchase__card-header">
              <h2>{t['admin.domains.purchase.step2Title']()}</h2>
              <p class="sanvi-purchase__card-desc">
                {t['admin.domains.purchase.step2Description']({ hostname: selectedQuote.hostname })}
              </p>
            </div>

            <div class="sanvi-purchase__selection-banner">
              <span class="sanvi-purchase__selection-label">{t['admin.domains.purchase.selectedDomainLabel']()}:</span>
              <strong>{selectedQuote.hostname}</strong>
              <span class="sanvi-purchase__selection-price">
                ({t['admin.domains.purchase.firstYearPrice']({
                  price: fmt.money(selectedQuote.register_price.amount_minor, selectedQuote.register_price.currency),
                })})
              </span>
            </div>

            <Field label={t['admin.domains.purchase.termLabel']()} required>
              {#snippet children(controlProps)}
                <Select
                  {...controlProps}
                  options={TERM_OPTIONS}
                  value={String(termYears)}
                  onchange={(e) => {
                    termYears = Number((e.target as HTMLSelectElement).value) || 1
                  }}
                />
              {/snippet}
            </Field>

            <div class="sanvi-purchase__toggle-group">
              <Checkbox bind:checked={autoRenew}>
                <strong>{t['admin.domains.purchase.autoRenewLabel']()}</strong>
              </Checkbox>
              <p class="sanvi-purchase__toggle-hint">{t['admin.domains.purchase.autoRenewHint']()}</p>
            </div>

            <div class="sanvi-purchase__toggle-group">
              <Checkbox bind:checked={whoisPrivacy}>
                <strong>{t['admin.domains.purchase.whoisPrivacyLabel']()}</strong>
              </Checkbox>
              <p class="sanvi-purchase__toggle-hint">{t['admin.domains.purchase.whoisPrivacyHint']()}</p>
            </div>

            <Cluster justify="space-between" align="center" gap="3">
              <Button variant="ghost" onclick={() => { step = 1 }}>
                {t['admin.domains.purchase.backButton']()}
              </Button>
              <Button variant="primary" onclick={proceedToRegistrant}>
                {t['admin.domains.purchase.continueToRegistrant']()}
              </Button>
            </Cluster>
          </Stack>
        </div>

      <!-- Step 3: Registrant Details -->
      {:else if step === 3 && selectedQuote}
        <div class="sanvi-purchase__card">
          <form novalidate onsubmit={(e) => { e.preventDefault(); proceedToReview(); }}>
            <Stack gap="5">
              <div>
                <h2>{t['admin.domains.purchase.step3Title']()}</h2>
                <p class="sanvi-purchase__card-desc">{t['admin.domains.purchase.step3Description']()}</p>
              </div>

              {#if registrantError}
                <Alert variant="error">{registrantError}</Alert>
              {/if}

              <Field label={t['admin.domains.purchase.nameLabel']()} required>
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={registrantName}
                    placeholder={t['admin.domains.purchase.namePlaceholder']()}
                    autocomplete="name"
                    required
                  />
                {/snippet}
              </Field>

              <Field label={t['admin.domains.purchase.orgLabel']()}>
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    bind:value={registrantOrg}
                    placeholder={t['admin.domains.purchase.orgPlaceholder']()}
                    autocomplete="organization"
                  />
                {/snippet}
              </Field>

              <Field label={t['admin.domains.purchase.emailLabel']()} required>
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    type="email"
                    bind:value={registrantEmail}
                    placeholder={t['admin.domains.purchase.emailPlaceholder']()}
                    autocomplete="email"
                    required
                  />
                {/snippet}
              </Field>

              <Field
                label={t['admin.domains.purchase.phoneLabel']()}
                hint={t['admin.domains.purchase.phoneHint']()}
                required
              >
                {#snippet children(controlProps)}
                  <Input
                    {...controlProps}
                    type="tel"
                    bind:value={registrantPhone}
                    placeholder={t['admin.domains.purchase.phonePlaceholder']()}
                    autocomplete="tel"
                    required
                  />
                {/snippet}
              </Field>

              <Field label={t['admin.domains.purchase.countryLabel']()} required>
                {#snippet children(controlProps)}
                  <Select
                    {...controlProps}
                    options={COUNTRY_OPTIONS}
                    bind:value={registrantCountry}
                    required
                  />
                {/snippet}
              </Field>

              <!-- Mandatory Disclosure Statement naming registrar subprocessor role -->
              <div class="sanvi-purchase__disclosure-panel">
                <p>{t['admin.domains.purchase.disclosureNotice']()}</p>
              </div>

              <Cluster justify="space-between" align="center" gap="3">
                <Button variant="ghost" onclick={() => { step = 2 }}>
                  {t['admin.domains.purchase.backButton']()}
                </Button>
                <Button type="submit" variant="primary">
                  {t['admin.domains.purchase.continueToReview']()}
                </Button>
              </Cluster>
            </Stack>
          </form>
        </div>

      <!-- Step 4: Review & Pay -->
      {:else if step === 4 && selectedQuote}
        <div class="sanvi-purchase__card">
          <Stack gap="5">
            <div>
              <h2>{t['admin.domains.purchase.step4Title']()}</h2>
              <p class="sanvi-purchase__card-desc">{t['admin.domains.purchase.step4Description']()}</p>
            </div>

            <div class="sanvi-purchase__summary-box">
              <h3>{t['admin.domains.purchase.orderSummaryTitle']()}</h3>
              <dl class="sanvi-purchase__summary-dl">
                <div class="sanvi-purchase__summary-row">
                  <dt>{t['admin.domains.purchase.summaryDomain']()}</dt>
                  <dd><strong>{selectedQuote.hostname}</strong></dd>
                </div>
                <div class="sanvi-purchase__summary-row">
                  <dt>{t['admin.domains.purchase.summaryTerm']()}</dt>
                  <dd>
                    {#if termYears === 1}
                      {t['admin.domains.purchase.termYear1']()}
                    {:else if termYears === 2}
                      {t['admin.domains.purchase.termYear2']()}
                    {:else if termYears === 3}
                      {t['admin.domains.purchase.termYear3']()}
                    {:else if termYears === 5}
                      {t['admin.domains.purchase.termYear5']()}
                    {/if}
                  </dd>
                </div>
                <div class="sanvi-purchase__summary-row">
                  <dt>{t['admin.domains.purchase.summaryAutoRenew']()}</dt>
                  <dd>
                    {autoRenew
                      ? t['admin.domains.purchase.enabledLabel']()
                      : t['admin.domains.purchase.disabledLabel']()}
                  </dd>
                </div>
                <div class="sanvi-purchase__summary-row">
                  <dt>{t['admin.domains.purchase.summaryWhoisPrivacy']()}</dt>
                  <dd>
                    {whoisPrivacy
                      ? t['admin.domains.purchase.enabledLabel']()
                      : t['admin.domains.purchase.disabledLabel']()}
                  </dd>
                </div>
                <div class="sanvi-purchase__summary-row">
                  <dt>{t['admin.domains.purchase.summaryRegistrant']()}</dt>
                  <dd>{registrantName} ({registrantEmail})</dd>
                </div>
                <div class="sanvi-purchase__summary-row sanvi-purchase__summary-row--total">
                  <dt>{t['admin.domains.purchase.summaryTodayTotal']()}</dt>
                  <dd class="sanvi-purchase__total-price">{totalTodayFormatted}</dd>
                </div>
              </dl>

              <div class="sanvi-purchase__renewal-note">
                <p>{t['admin.domains.purchase.summaryRenewalPrice']({ price: renewPriceFormatted })}</p>
              </div>
            </div>

            <!-- Non-refundability notice -->
            <div class="sanvi-purchase__terms-callout">
              <p>{t['admin.domains.purchase.nonRefundableNotice']()}</p>
            </div>

            <Cluster justify="space-between" align="center" gap="3">
              <Button variant="ghost" onclick={() => { step = 3 }} disabled={submitting}>
                {t['admin.domains.purchase.backButton']()}
              </Button>
              <Button
                variant="primary"
                loading={submitting}
                loadingLabel={t['admin.domains.purchase.placingOrder']()}
                onclick={handlePlaceOrder}
              >
                {t['admin.domains.purchase.placeOrderButton']()}
              </Button>
            </Cluster>
          </Stack>
        </div>

      <!-- Step 5: Provisioning -->
      {:else if step === 5}
        <div class="sanvi-purchase__card">
          <Stack gap="5">
            <div class="sanvi-purchase__status-header" aria-live="polite">
              <h2>{t['admin.domains.purchase.step5Title']()}</h2>
              <p class="sanvi-purchase__card-desc">{t['admin.domains.purchase.step5Description']()}</p>
            </div>

            {#if currentOrder?.status === 'failed'}
              <Alert variant="error">
                <strong>{t['admin.domains.purchase.failedTitle']()}</strong>
                <p>{t['admin.domains.purchase.failedMessage']()}</p>
              </Alert>
              <Button variant="primary" onclick={handleResetToSearch}>
                {t['admin.domains.purchase.tryAgainButton']()}
              </Button>
            {:else if currentOrder?.status === 'refunded'}
              <Alert variant="error">
                <strong>{t['admin.domains.purchase.refundedTitle']()}</strong>
                <p>{t['admin.domains.purchase.refundedMessage']()}</p>
              </Alert>
              <Button variant="primary" onclick={handleResetToSearch}>
                {t['admin.domains.purchase.tryAgainButton']()}
              </Button>
            {:else}
              <div class="sanvi-purchase__spinner-box" aria-live="polite">
                <Spinner size="md" label={provisioningStatusText} />
                <p class="sanvi-purchase__progress-label">{provisioningStatusText}</p>
              </div>

              <div class="sanvi-purchase__meta-panel">
                <Cluster justify="space-between" align="center" gap="4">
                  <span class="sanvi-purchase__elapsed">
                    {t['admin.domains.purchase.elapsedTime']({ time: formatElapsedTime(elapsedTimeSec) })}
                  </span>
                  {#if currentOrder}
                    {@const orderHost = currentOrder.hostname}
                    <Badge variant="info">
                      {#snippet children()}
                        {orderHost}
                      {/snippet}
                    </Badge>
                  {/if}
                </Cluster>
              </div>

              <div class="sanvi-purchase__leave-panel">
                <p>{t['admin.domains.purchase.leaveNotice']()}</p>
              </div>
            {/if}
          </Stack>
        </div>

      <!-- Step 6: Live -->
      {:else if step === 6}
        <div class="sanvi-purchase__card">
          <Stack gap="5">
            <div class="sanvi-purchase__live-header" aria-live="polite">
              <Badge variant="success">
                {#snippet children()}
                  {t['admin.domains.statusLive']()}
                {/snippet}
              </Badge>
              <h2>{t['admin.domains.purchase.step6Title']()}</h2>
              <p class="sanvi-purchase__card-desc">{t['admin.domains.purchase.step6Description']()}</p>
              <p class="sanvi-purchase__live-url">
                {t['admin.domains.purchase.liveUrlLabel']({
                  url: `https://${domain?.hostname || currentOrder?.hostname || ''}`,
                })}
              </p>
            </div>

            <div class="sanvi-purchase__next-steps">
              <h3>{t['admin.domains.purchase.nextStepsTitle']()}</h3>
              <ul>
                <li>{t['admin.domains.purchase.nextStepPrimary']()}</li>
              </ul>
            </div>

            <Cluster gap="3">
              <a
                class="sanvi-purchase__action-link"
                href={`https://${domain?.hostname || currentOrder?.hostname || ''}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="primary">
                  {t['admin.domains.purchase.visitStorefront']()}
                </Button>
              </a>
              <a
                class="sanvi-purchase__action-link"
                href={domain?.id ? `/domains/${domain.id}` : '/domains'}
              >
                <Button variant="secondary">
                  {t['admin.domains.purchase.viewDetails']()}
                </Button>
              </a>
            </Cluster>
          </Stack>
        </div>
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-purchase__back-link {
    color: var(--sanvi-color-solid-primary-base);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-purchase__back-link:hover {
    text-decoration: underline;
  }

  .sanvi-purchase__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase__subtitle {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  /* Stepper */
  .sanvi-purchase-stepper {
    width: 100%;
    overflow-x: auto;
  }

  .sanvi-purchase-stepper__list {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-purchase-stepper__item {
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

  .sanvi-purchase-stepper__num {
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

  .sanvi-purchase-stepper__item--active {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-purchase-stepper__item--active .sanvi-purchase-stepper__num {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-purchase-stepper__item--complete {
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase-stepper__item--complete .sanvi-purchase-stepper__num {
    background: var(--sanvi-color-solid-success-base);
    color: var(--sanvi-color-text-inverse);
  }

  /* Card */
  .sanvi-purchase__card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-purchase__card h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase__card-desc {
    margin: var(--sanvi-spacing-1) 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__search-input-wrap {
    flex: 1;
  }

  .sanvi-purchase__search-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-6);
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-purchase__search-loading p {
    margin: 0;
  }

  .sanvi-purchase__empty-search {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    text-align: center;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-purchase__empty-search p {
    margin: 0;
  }

  .sanvi-purchase__results-list {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-quote-card {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-quote-card--selected {
    border-color: var(--sanvi-color-solid-primary-base);
    background: var(--sanvi-color-background-primary);
    box-shadow: 0 0 0 1px var(--sanvi-color-solid-primary-base);
  }

  .sanvi-quote-card--unavailable {
    opacity: 0.6;
  }

  .sanvi-quote-card__hostname {
    font-size: var(--sanvi-font-size-md);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-quote-card__pricing {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-quote-card__register-price {
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase__actions {
    display: flex;
    justify-content: flex-end;
  }

  .sanvi-purchase__selection-banner {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    font-size: var(--sanvi-font-size-sm);
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-purchase__selection-label {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__selection-price {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-purchase__toggle-group {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    padding: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-purchase__toggle-hint {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    padding-inline-start: var(--sanvi-spacing-6);
  }

  .sanvi-purchase__disclosure-panel {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-solid-primary-base);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__disclosure-panel p {
    margin: 0;
  }

  .sanvi-purchase__summary-box {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-purchase__summary-box h3 {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase__summary-dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-purchase__summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-purchase__summary-row dt {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__summary-row dd {
    margin: 0;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-purchase__summary-row--total {
    padding-block-start: var(--sanvi-spacing-2);
    border-block-start: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-purchase__total-price {
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-purchase__renewal-note {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__renewal-note p {
    margin: 0;
  }

  .sanvi-purchase__terms-callout {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__terms-callout p {
    margin: 0;
  }

  .sanvi-purchase__status-header {
    text-align: center;
  }

  .sanvi-purchase__spinner-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-8);
  }

  .sanvi-purchase__progress-label {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-purchase__meta-panel {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-purchase__elapsed {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-purchase__leave-panel {
    text-align: center;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__leave-panel p {
    margin: 0;
  }

  .sanvi-purchase__live-header {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    align-items: flex-start;
  }

  .sanvi-purchase__live-url {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-solid-success-base);
  }

  .sanvi-purchase__next-steps {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-purchase__next-steps h3 {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-purchase__next-steps ul {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-4);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-purchase__action-link {
    text-decoration: none;
  }
</style>
