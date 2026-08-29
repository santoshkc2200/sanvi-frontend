<script lang="ts">
import {
  ApiError,
  checkSlugAvailability,
  createCheckoutSession,
  getSubscription,
  listPublicPlans,
  provisionTenant,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveMembership, getMemberships, setMemberships, switchTenant } from '@sanvi/tenant'
import type { TenantMembership } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  Field,
  Input,
  Select,
  Spinner,
  Stack,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type PublicPlan = components['schemas']['PublicPlanView']

const REGION_OPTIONS = $derived([
  { value: 'us', label: t['admin.onboarding.regionOptionUs']() },
  { value: 'eu', label: t['admin.onboarding.regionOptionEu']() },
  { value: 'ap', label: t['admin.onboarding.regionOptionAp']() },
])

const LOCALE_OPTIONS = $derived([
  { value: 'en', label: t['admin.onboarding.localeOptionEn']() },
  { value: 'ja', label: t['admin.onboarding.localeOptionJa']() },
])

const params = new URLSearchParams(window.location.search)
const initialPlanKey = params.get('plan') ?? 'starter'
const initialInterval = (params.get('interval') ?? 'month') as 'month' | 'year'
const initialCurrency = (params.get('currency') ?? 'USD').toUpperCase()

let step = $state<1 | 2>(1)
let displayName = $state('')
let slug = $state('')
let slugManuallyEdited = $state(false)
let region = $state('us')
let defaultLocale = $state('en')

let selectedPlanKey = $state(initialPlanKey)
let selectedInterval = $state<'month' | 'year'>(initialInterval)
let selectedCurrency = $state(initialCurrency)

let slugStatus = $state<'idle' | 'checking' | 'available' | 'unavailable'>('idle')
let slugSuggestions = $state<string[]>([])
let slugCheckTimer: ReturnType<typeof setTimeout> | undefined
let slugCheckSeq = 0
let slugAbortController: AbortController | undefined

let plans = $state<PublicPlan[]>([])
let loadingPlans = $state(true)
let submitting = $state(false)
let error = $state<string | undefined>(undefined)

const activeMembership = $derived(getActiveMembership())

$effect(() => {
  if (activeMembership && !displayName) {
    displayName = activeMembership.displayName
    slug = activeMembership.slug
    step = 2
  }
})

$effect(() => {
  listPublicPlans(apiClient)
    .then((result) => {
      plans = result ?? []
    })
    .catch(() => {
      plans = []
    })
    .finally(() => {
      loadingPlans = false
    })
})

$effect(() => {
  if (plans.length > 0 && !plans.some((p) => p.key === selectedPlanKey)) {
    selectedPlanKey = plans[0]!.key
  }
})

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
}

function handleNameChange(val: string): void {
  displayName = val
  if (step === 1 && !slugManuallyEdited) {
    const generated = generateSlug(val)
    slug = generated
    triggerSlugCheck(generated)
  }
}

function handleSlugInput(val: string): void {
  slugManuallyEdited = true
  slug = generateSlug(val)
  triggerSlugCheck(slug)
}

function triggerSlugCheck(candidate: string): void {
  if (slugCheckTimer) clearTimeout(slugCheckTimer)
  if (slugAbortController) {
    slugAbortController.abort()
    slugAbortController = undefined
  }
  const seq = ++slugCheckSeq

  if (candidate.length < 3) {
    slugStatus = 'idle'
    slugSuggestions = []
    return
  }

  slugStatus = 'checking'
  slugCheckTimer = setTimeout(async () => {
    const controller = new AbortController()
    slugAbortController = controller
    try {
      const res = await checkSlugAvailability(apiClient, candidate, controller.signal)
      if (seq !== slugCheckSeq) return
      if (res?.available) {
        slugStatus = 'available'
        slugSuggestions = []
      } else {
        slugStatus = 'unavailable'
        slugSuggestions = [
          `${candidate}-app`,
          `${candidate}-hq`,
          `${candidate}-academy`,
          `${candidate}-learn`,
        ]
      }
    } catch {
      if (seq !== slugCheckSeq) return
      slugStatus = 'idle'
      slugSuggestions = []
    } finally {
      if (slugAbortController === controller) {
        slugAbortController = undefined
      }
    }
  }, 400)
}

const selectedPlan = $derived(plans.find((p) => p.key === selectedPlanKey) ?? plans[0])
const selectedPrice = $derived(
  selectedPlan?.prices.find(
    (p) => p.interval === selectedInterval && p.currency.toUpperCase() === selectedCurrency,
  ) ?? selectedPlan?.prices[0],
)

function proceedToPlan(): void {
  if (!displayName.trim() || !slug.trim()) {
    error = t['admin.onboarding.nameAndSlugRequired']()
    return
  }
  error = undefined
  step = 2
}

async function handleCheckout(): Promise<void> {
  if (!selectedPrice) {
    error = t['admin.onboarding.priceRequired']()
    return
  }

  submitting = true
  error = undefined

  try {
    // If tenant not yet created, provision it first
    if (!activeMembership) {
      const provisioned = await provisionTenant(apiClient, {
        display_name: displayName.trim(),
        slug: slug.trim(),
        region,
        default_locale: defaultLocale,
      })
      if (provisioned?.id) {
        const newMembership: TenantMembership = {
          tenantId: provisioned.id,
          slug: provisioned.slug,
          displayName: provisioned.display_name,
          role: 'owner',
        }
        setMemberships([...getMemberships(), newMembership])
        switchTenant(provisioned.id)
      }
    }

    const session = await createCheckoutSession(apiClient, {
      price_id: selectedPrice.price_id,
      success_url: `${window.location.origin}/activating`,
      cancel_url: window.location.href,
    })

    if (session?.url) {
      window.location.href = session.url
    } else {
      error = t['admin.onboarding.genericError']()
      submitting = false
    }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      error = t['admin.onboarding.forbiddenError']()
    } else {
      error = t['admin.onboarding.genericError']()
    }
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{t['admin.onboarding.title']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <div class="sanvi-onboarding__header">
      <h1>{t['admin.onboarding.title']()}</h1>
      <p>{t['admin.onboarding.description']()}</p>
    </div>

    {#if activeMembership}
      <Alert variant="info">
        {t['admin.onboarding.resumingNotice']({ name: activeMembership.displayName })}
      </Alert>
    {/if}

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    <!-- Step 1: Workspace Details -->
    {#if step === 1}
      <div class="sanvi-onboarding__card">
        <Stack gap="5">
          <h2>{t['admin.onboarding.step1Title']()}</h2>

          <Field label={t['admin.onboarding.nameLabel']()} required>
            {#snippet children(controlProps)}
              <Input
                {...controlProps}
                bind:value={displayName}
                placeholder={t['admin.onboarding.namePlaceholder']()}
                oninput={(e) => handleNameChange((e.target as HTMLInputElement).value)}
              />
            {/snippet}
          </Field>

          <Field
            label={t['admin.onboarding.slugLabel']()}
            hint={t['admin.onboarding.slugRules']()}
            error={slugStatus === 'unavailable' ? t['admin.onboarding.slugUnavailable']() : undefined}
            required
          >
            {#snippet children(controlProps)}
              <Input
                {...controlProps}
                bind:value={slug}
                placeholder={t['admin.onboarding.slugPlaceholder']()}
                oninput={(e) => handleSlugInput((e.target as HTMLInputElement).value)}
              />
            {/snippet}
          </Field>

          {#if slugStatus === 'checking'}
            <p class="sanvi-onboarding__slug-status">{t['admin.onboarding.slugChecking']()}</p>
          {:else if slugStatus === 'available'}
            <p class="sanvi-onboarding__slug-status sanvi-onboarding__slug-status--ok">
              ✓ {t['admin.onboarding.slugAvailable']()}
            </p>
          {:else if slugStatus === 'unavailable' && slugSuggestions.length > 0}
            <Cluster gap="2">
              {#each slugSuggestions as sug}
                <Button
                  variant="ghost"
                  onclick={() => {
                    slug = sug
                    triggerSlugCheck(sug)
                  }}
                >
                  {sug}
                </Button>
              {/each}
            </Cluster>
          {/if}

          <Field label={t['admin.onboarding.regionLabel']()}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                options={REGION_OPTIONS}
                bind:value={region}
              />
            {/snippet}
          </Field>

          <Field label={t['admin.onboarding.localeLabel']()}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                options={LOCALE_OPTIONS}
                bind:value={defaultLocale}
              />
            {/snippet}
          </Field>

          <Button
            variant="primary"
            disabled={!displayName.trim() || !slug.trim() || slugStatus !== 'available'}
            onclick={proceedToPlan}
          >
            {t['admin.onboarding.continueToPlan']()}
          </Button>
        </Stack>
      </div>

    <!-- Step 2: Plan Selection & Confirmation -->
    {:else if step === 2}
      <div class="sanvi-onboarding__card">
        <Stack gap="5">
          <div class="sanvi-onboarding__plan-header">
            <h2>{t['admin.onboarding.step2Title']()}</h2>
            {#if !activeMembership}
              <Button variant="ghost" onclick={() => { step = 1 }}>
                {t['admin.onboarding.backButton']()}
              </Button>
            {/if}
          </div>

          {#if loadingPlans}
            <Spinner label={t['admin.onboarding.loadingPlans']()} />
          {:else}
            <!-- Interval Toggle -->
            <Cluster gap="2">
              <Button
                variant={selectedInterval === 'month' ? 'primary' : 'secondary'}
                onclick={() => { selectedInterval = 'month' }}
              >
                {t['admin.onboarding.monthlyInterval']()}
              </Button>
              <Button
                variant={selectedInterval === 'year' ? 'primary' : 'secondary'}
                onclick={() => { selectedInterval = 'year' }}
              >
                {t['admin.onboarding.annualInterval']()}
              </Button>
            </Cluster>

            <!-- Plan Cards Selection -->
            <div class="sanvi-onboarding__plan-list">
              {#each plans as plan (plan.plan_id)}
                {@const price = plan.prices.find((p) => p.interval === selectedInterval && p.currency.toUpperCase() === selectedCurrency) ?? plan.prices[0]}
                {@const isSelected = plan.key === selectedPlanKey}
                <button
                  type="button"
                  class="sanvi-plan-choice {isSelected ? 'sanvi-plan-choice--selected' : ''}"
                  onclick={() => { selectedPlanKey = plan.key }}
                >
                  <Stack gap="2" align="start">
                    <div class="sanvi-plan-choice__header">
                      <strong>{plan.name}</strong>
                      {#if price}
                        <span class="sanvi-plan-choice__price">
                          {fmt.money(price.unit_amount_minor, price.currency)} / {price.interval}
                        </span>
                      {/if}
                    </div>
                    {#if price?.trial_days}
                      <Badge variant="info">{t['admin.onboarding.trialBadge']({ days: price.trial_days })}</Badge>
                    {/if}
                  </Stack>
                </button>
              {/each}
            </div>

            <!-- Explicit Trial Terms -->
            <div class="sanvi-onboarding__terms">
              <strong>{t['admin.onboarding.trialTermsHeader']()}</strong>
              <ul>
                <li>{t['admin.onboarding.trialTerms1']()}</li>
                <li>{t['admin.onboarding.trialTerms2']()}</li>
                <li>{t['admin.onboarding.trialTerms3']()}</li>
              </ul>
            </div>

            <Button
              variant="primary"
              loading={submitting}
              onclick={handleCheckout}
            >
              {t['admin.onboarding.startTrialButton']()}
            </Button>
          {/if}
        </Stack>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-onboarding__header {
    text-align: center;
  }

  .sanvi-onboarding__header h1 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-onboarding__header p {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-onboarding__card {
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-onboarding__card h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
  }

  .sanvi-onboarding__slug-status {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-onboarding__slug-status--ok {
    color: var(--sanvi-color-status-success);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-onboarding__plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-onboarding__plan-list {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-plan-choice {
    width: 100%;
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    text-align: start;
    cursor: pointer;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-plan-choice--selected {
    border-color: var(--sanvi-color-solid-primary-base);
    background: var(--sanvi-color-background-primary);
    box-shadow: 0 0 0 1px var(--sanvi-color-solid-primary-base);
  }

  .sanvi-plan-choice__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .sanvi-plan-choice__price {
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-onboarding__terms {
    padding: var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-onboarding__terms ul {
    margin: var(--sanvi-spacing-2) 0 0;
    padding-inline-start: var(--sanvi-spacing-4);
  }
</style>
