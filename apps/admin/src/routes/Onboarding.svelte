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
import { formatMinor } from '@sanvi/billing-elements'
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

const REGION_OPTIONS = [
  { value: 'us', label: 'US East (North Virginia)' },
  { value: 'eu', label: 'Europe (Frankfurt)' },
  { value: 'ap', label: 'Asia Pacific (Tokyo)' },
]

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語 (Japanese)' },
]

const COPY = {
  title: 'Set up your workspace',
  description: 'Create your organization and configure your subscription.',
  step1Title: '1. Organization details',
  step2Title: '2. Confirm plan & free trial',
  nameLabel: 'Workspace name',
  namePlaceholder: 'Acme Academy',
  slugLabel: 'Subdomain / Slug',
  slugPlaceholder: 'acme',
  slugRules: 'Use 3–32 lowercase letters, numbers, and hyphens.',
  slugChecking: 'Checking availability...',
  slugAvailable: 'Slug is available!',
  slugUnavailable: 'This slug is already taken. Try one of these alternatives:',
  regionLabel: 'Hosting region',
  localeLabel: 'Default language',
  continueToPlan: 'Continue to plan selection',
  backButton: 'Back',
  startTrialButton: 'Start 14-day free trial with Stripe',
  trialTermsHeader: 'Trial Terms & Conditions:',
  trialTerms1: '14 days of free access to all included features.',
  trialTerms2: 'Cancel anytime in the billing centre before trial ends with zero charge.',
  trialTerms3: 'Taxes are calculated at checkout based on your billing address.',
  loadingPlans: 'Loading plans...',
  genericError: 'Something went wrong. Please check your inputs and try again.',
  forbiddenError:
    'Self-serve organization creation is not available. Please contact support to provision your workspace.',
  resumingNotice: (name: string) =>
    `Finish setting up billing for "${name}" to activate your workspace.`,
  monthlyInterval: 'Monthly',
  annualInterval: 'Annual (Save up to 20%)',
  trialBadge: (days: number) => `${days}-day free trial`,
}

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
    error = 'Please provide a workspace name and slug.'
    return
  }
  error = undefined
  step = 2
}

async function handleCheckout(): Promise<void> {
  if (!selectedPrice) {
    error = 'Please select a valid plan price.'
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
      error = COPY.genericError
      submitting = false
    }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      error = COPY.forbiddenError
    } else {
      error = COPY.genericError
    }
    submitting = false
  }
}
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <div class="sanvi-onboarding__header">
      <h1>{COPY.title}</h1>
      <p>{COPY.description}</p>
    </div>

    {#if activeMembership}
      <Alert variant="info">
        {COPY.resumingNotice(activeMembership.displayName)}
      </Alert>
    {/if}

    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    <!-- Step 1: Workspace Details -->
    {#if step === 1}
      <div class="sanvi-onboarding__card">
        <Stack gap="5">
          <h2>{COPY.step1Title}</h2>

          <Field label={COPY.nameLabel} required>
            {#snippet children(controlProps)}
              <Input
                {...controlProps}
                bind:value={displayName}
                placeholder={COPY.namePlaceholder}
                oninput={(e) => handleNameChange((e.target as HTMLInputElement).value)}
              />
            {/snippet}
          </Field>

          <Field
            label={COPY.slugLabel}
            hint={COPY.slugRules}
            error={slugStatus === 'unavailable' ? COPY.slugUnavailable : undefined}
            required
          >
            {#snippet children(controlProps)}
              <Input
                {...controlProps}
                bind:value={slug}
                placeholder={COPY.slugPlaceholder}
                oninput={(e) => handleSlugInput((e.target as HTMLInputElement).value)}
              />
            {/snippet}
          </Field>

          {#if slugStatus === 'checking'}
            <p class="sanvi-onboarding__slug-status">{COPY.slugChecking}</p>
          {:else if slugStatus === 'available'}
            <p class="sanvi-onboarding__slug-status sanvi-onboarding__slug-status--ok">
              ✓ {COPY.slugAvailable}
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

          <Field label={COPY.regionLabel}>
            {#snippet children(controlProps)}
              <Select
                {...controlProps}
                options={REGION_OPTIONS}
                bind:value={region}
              />
            {/snippet}
          </Field>

          <Field label={COPY.localeLabel}>
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
            {COPY.continueToPlan}
          </Button>
        </Stack>
      </div>

    <!-- Step 2: Plan Selection & Confirmation -->
    {:else if step === 2}
      <div class="sanvi-onboarding__card">
        <Stack gap="5">
          <div class="sanvi-onboarding__plan-header">
            <h2>{COPY.step2Title}</h2>
            {#if !activeMembership}
              <Button variant="ghost" onclick={() => { step = 1 }}>
                {COPY.backButton}
              </Button>
            {/if}
          </div>

          {#if loadingPlans}
            <Spinner label={COPY.loadingPlans} />
          {:else}
            <!-- Interval Toggle -->
            <Cluster gap="2">
              <Button
                variant={selectedInterval === 'month' ? 'primary' : 'secondary'}
                onclick={() => { selectedInterval = 'month' }}
              >
                {COPY.monthlyInterval}
              </Button>
              <Button
                variant={selectedInterval === 'year' ? 'primary' : 'secondary'}
                onclick={() => { selectedInterval = 'year' }}
              >
                {COPY.annualInterval}
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
                          {formatMinor(price.unit_amount_minor, price.currency)} / {price.interval}
                        </span>
                      {/if}
                    </div>
                    {#if price?.trial_days}
                      <Badge variant="info">{COPY.trialBadge(price.trial_days)}</Badge>
                    {/if}
                  </Stack>
                </button>
              {/each}
            </div>

            <!-- Explicit Trial Terms -->
            <div class="sanvi-onboarding__terms">
              <strong>{COPY.trialTermsHeader}</strong>
              <ul>
                <li>{COPY.trialTerms1}</li>
                <li>{COPY.trialTerms2}</li>
                <li>{COPY.trialTerms3}</li>
              </ul>
            </div>

            <Button
              variant="primary"
              loading={submitting}
              onclick={handleCheckout}
            >
              {COPY.startTrialButton}
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
