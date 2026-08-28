<script lang="ts">
import { formatMinor } from '@sanvi/billing-elements'
import { Badge, Button, Cluster, Container, Radio, Stack, Table } from '@sanvi/ui'
import { COMPARISON_FEATURES, calculateAnnualSavingsPercentage, getPriceForPlan } from '$lib/plans'
import type { PriceInterval, PublicPlanView } from '$lib/plans'
import type { PageData } from './$types'

interface Props {
  data: PageData
}

let { data }: Props = $props()

let interval = $state<PriceInterval>('month')
let currency = $state<string>('USD')

const plans = $derived<PublicPlanView[]>(data.plans)

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'JPY', label: 'JPY (¥)' },
]

const COPY = {
  pageTitle: 'Pricing — Sanvi',
  metaDescription:
    'Simple, transparent pricing for course creators and organizations. Start your 14-day free trial today.',
  heading: 'Simple, transparent pricing',
  subheading:
    'Choose the right plan to build, launch, and scale your course platform. Every plan includes a 14-day free trial.',
  billingCycleLabel: 'Billing interval',
  monthly: 'Monthly',
  annual: 'Annual',
  saveBadge: (percent: number) => `Save ${percent}%`,
  saveUpTo: 'Save up to 20% on annual billing',
  currencyLabel: 'Currency',
  perMonth: '/month',
  perYear: '/year',
  trialBadge: (days: number) => `${days}-day free trial`,
  mostPopular: 'Most Popular',
  startTrial: 'Start 14-day trial',
  getStarted: 'Get started',
  taxNote: 'Taxes calculated at checkout based on your billing address and tax identification.',
  featureComparisonTitle: 'Compare all features',
  featureComparisonSubtitle: 'See which plan fits your platform requirements.',
  featureCol: 'Feature',
  included: 'Included',
  notIncluded: 'Not included',
  unlimited: 'Unlimited',
  faqTitle: 'Frequently asked questions',
  faqs: [
    {
      q: 'How does the 14-day free trial work?',
      a: 'You can test all features of your chosen plan for 14 days without charge. You can cancel at any time during the trial with zero cost.',
    },
    {
      q: 'Can I change my plan later?',
      a: 'Yes. You can upgrade, downgrade, or switch between monthly and annual intervals at any time directly through the billing centre in your admin console.',
    },
    {
      q: 'How is sales tax or VAT handled?',
      a: 'Tax is calculated at checkout based on your country and jurisdiction. Registered businesses can input their VAT or tax ID to apply reverse charges where applicable.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept major credit and debit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and localized payment methods via Stripe.',
    },
  ],
}

const maxAnnualSavings = $derived(() => {
  let max = 0
  for (const plan of plans) {
    const s = calculateAnnualSavingsPercentage(plan, currency)
    if (s && s > max) max = s
  }
  return max > 0 ? max : null
})

function escapeJsonLd(json: string): string {
  return json.replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}

const structuredData = $derived(
  escapeJsonLd(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Sanvi Course Platform',
      description: COPY.metaDescription,
      offers: plans.flatMap((plan) =>
        plan.prices.map((price) => ({
          '@type': 'Offer',
          name: `${plan.name} (${price.interval})`,
          price: price.unit_amount_minor / (price.currency === 'JPY' ? 1 : 100),
          priceCurrency: price.currency,
          url: `https://sanvi.app/pricing#${plan.key}`,
        })),
      ),
    }),
  ),
)
// biome-ignore lint/style/useTemplate: avoids breaking script parser in HTML
const jsonLdScript = $derived(`<script type="application/ld+json">${structuredData}</` + `script>`)
</script>

<svelte:head>
  <title>{COPY.pageTitle}</title>
  <meta name="description" content={COPY.metaDescription} />
  <meta property="og:title" content={COPY.pageTitle} />
  <meta property="og:description" content={COPY.metaDescription} />
  <!-- Structured Data for SEO -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<div class="sanvi-pricing-page">
  <Container size="lg" padding="6">
    <Stack gap="10" align="center">
      <!-- Header -->
      <Stack gap="3" align="center">
        <h1 class="sanvi-pricing-page__title">{COPY.heading}</h1>
        <p class="sanvi-pricing-page__subtitle">{COPY.subheading}</p>
      </Stack>

      <!-- Controls: Interval & Currency -->
      <Cluster gap="6" justify="center" align="center">
        <fieldset class="sanvi-pricing-page__toggle-group" aria-label={COPY.billingCycleLabel}>
          <legend class="sanvi-pricing-page__sr-only">{COPY.billingCycleLabel}</legend>
          <button
            type="button"
            class="sanvi-pricing-page__toggle-button {interval === 'month' ? 'sanvi-pricing-page__toggle-button--active' : ''}"
            onclick={() => { interval = 'month' }}
          >
            {COPY.monthly}
          </button>
          <button
            type="button"
            class="sanvi-pricing-page__toggle-button {interval === 'year' ? 'sanvi-pricing-page__toggle-button--active' : ''}"
            onclick={() => { interval = 'year' }}
          >
            {COPY.annual}
            {#if maxAnnualSavings() !== null}
              <Badge variant="success">{COPY.saveBadge(maxAnnualSavings()!)}</Badge>
            {/if}
          </button>
        </fieldset>

        <div class="sanvi-pricing-page__currency-selector">
          <label for="currency-select" class="sanvi-pricing-page__currency-label">
            {COPY.currencyLabel}:
          </label>
          <select
            id="currency-select"
            class="sanvi-pricing-page__select"
            bind:value={currency}
          >
            {#each CURRENCY_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      </Cluster>

      <!-- Plan Cards Grid -->
      <div class="sanvi-pricing-page__cards-grid">
        {#each plans as plan (plan.plan_id)}
          {@const price = getPriceForPlan(plan, currency, interval)}
          {@const isPopular = plan.tier === 'professional'}
          <div
            class="sanvi-plan-card {isPopular ? 'sanvi-plan-card--popular' : ''}"
            id="plan-{plan.key}"
          >
            {#if isPopular}
              <div class="sanvi-plan-card__badge-wrapper">
                <span class="sanvi-plan-card__popular-badge">{COPY.mostPopular}</span>
              </div>
            {/if}

            <Stack gap="4">
              <div class="sanvi-plan-card__header">
                <h2 class="sanvi-plan-card__name">{plan.name}</h2>
                {#if price?.trial_days}
                  <Badge variant="info">{COPY.trialBadge(price.trial_days)}</Badge>
                {/if}
              </div>

              <div class="sanvi-plan-card__price-wrapper">
                {#if price}
                  <span class="sanvi-plan-card__amount">
                    {formatMinor(price.unit_amount_minor, price.currency)}
                  </span>
                  <span class="sanvi-plan-card__interval">
                    {interval === 'month' ? COPY.perMonth : COPY.perYear}
                  </span>
                {:else}
                  <span class="sanvi-plan-card__amount">—</span>
                {/if}
              </div>

              <a
                class="sanvi-plan-card__cta {isPopular ? 'sanvi-plan-card__cta--primary' : 'sanvi-plan-card__cta--secondary'}"
                href="/signup?plan={plan.key}&interval={interval}&currency={currency}"
              >
                {price?.trial_days ? COPY.startTrial : COPY.getStarted}
              </a>

              <hr class="sanvi-plan-card__divider" />

              <ul class="sanvi-plan-card__feature-list" aria-label="{plan.name} features">
                {#each plan.entitlements as ent (ent.feature_key)}
                  <li class="sanvi-plan-card__feature-item">
                    <span class="sanvi-plan-card__check" aria-hidden="true">
                      {ent.enabled ? '✓' : '—'}
                    </span>
                    <span class="sanvi-plan-card__feature-text">
                      {#if ent.limit !== null && ent.limit !== undefined}
                        {ent.limit} {ent.feature_key.replace('.', ' ')}
                      {:else if ent.enabled && ent.limit === null}
                        {COPY.unlimited} {ent.feature_key.replace('.', ' ')}
                      {:else}
                        {ent.feature_key.replace('.', ' ')}
                      {/if}
                    </span>
                  </li>
                {/each}
              </ul>
            </Stack>
          </div>
        {/each}
      </div>

      <p class="sanvi-pricing-page__tax-note">{COPY.taxNote}</p>

      <!-- Feature Comparison Table -->
      <div class="sanvi-pricing-page__comparison-section">
        <Stack gap="6" align="center">
          <div class="sanvi-pricing-page__comparison-header">
            <h2>{COPY.featureComparisonTitle}</h2>
            <p>{COPY.featureComparisonSubtitle}</p>
          </div>

          <div class="sanvi-pricing-page__table-wrapper">
            <table class="sanvi-comparison-table">
              <caption class="sanvi-pricing-page__sr-only">{COPY.featureComparisonTitle}</caption>
              <thead>
                <tr>
                  <th scope="col" class="sanvi-comparison-table__feature-header">{COPY.featureCol}</th>
                  {#each plans as plan}
                    <th scope="col" class="sanvi-comparison-table__plan-header">{plan.name}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each COMPARISON_FEATURES as feature (feature.key)}
                  <tr>
                    <th scope="row" class="sanvi-comparison-table__feature-cell">
                      <span class="sanvi-comparison-table__feature-name">{feature.name}</span>
                      <span class="sanvi-comparison-table__feature-desc">{feature.description}</span>
                    </th>
                    {#each plans as plan}
                      {@const grant = plan.entitlements.find((e) => e.feature_key === feature.key)}
                      <td class="sanvi-comparison-table__value-cell">
                        {#if grant}
                          {#if grant.limit !== null && grant.limit !== undefined}
                            <strong>{grant.limit}</strong>
                          {:else if grant.enabled && grant.limit === null}
                            <strong>{COPY.unlimited}</strong>
                          {:else if grant.enabled}
                            <span class="sanvi-comparison-table__check" aria-label={COPY.included}>✓</span>
                          {:else}
                            <span class="sanvi-comparison-table__cross" aria-label={COPY.notIncluded}>—</span>
                          {/if}
                        {:else}
                          <span class="sanvi-comparison-table__cross" aria-label={COPY.notIncluded}>—</span>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Stack>
      </div>

      <!-- FAQ Section -->
      <div class="sanvi-pricing-page__faq-section">
        <Stack gap="6">
          <h2 class="sanvi-pricing-page__faq-title">{COPY.faqTitle}</h2>
          <div class="sanvi-pricing-page__faq-grid">
            {#each COPY.faqs as faq}
              <div class="sanvi-faq-item">
                <h3 class="sanvi-faq-item__question">{faq.q}</h3>
                <p class="sanvi-faq-item__answer">{faq.a}</p>
              </div>
            {/each}
          </div>
        </Stack>
      </div>
    </Stack>
  </Container>
</div>

<style>
  .sanvi-pricing-page {
    padding-block: var(--sanvi-spacing-8);
  }

  .sanvi-pricing-page__title {
    margin: 0;
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    text-align: center;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-pricing-page__subtitle {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
    max-width: 42rem; /* sanvi-tokens-ignore */
  }

  .sanvi-pricing-page__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .sanvi-pricing-page__toggle-group {
    display: inline-flex;
    align-items: center;
    padding: var(--sanvi-spacing-1);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    gap: var(--sanvi-spacing-1);
    margin: 0;
  }

  .sanvi-pricing-page__toggle-button {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border: none;
    border-radius: var(--sanvi-radius-md);
    background: transparent;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    cursor: pointer;
  }

  .sanvi-pricing-page__toggle-button--active {
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-pricing-page__currency-selector {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-pricing-page__currency-label {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-pricing-page__select {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-pricing-page__cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); /* sanvi-tokens-ignore */
    gap: var(--sanvi-spacing-6);
    width: 100%;
  }

  .sanvi-plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-plan-card--popular {
    border-color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-plan-card__badge-wrapper {
    position: absolute;
    top: 0;
    right: var(--sanvi-spacing-6);
    transform: translateY(-50%);
  }

  .sanvi-plan-card__popular-badge {
    display: inline-flex;
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-bold);
    text-transform: uppercase;
  }

  .sanvi-plan-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-plan-card__name {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-plan-card__price-wrapper {
    display: flex;
    align-items: baseline;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-plan-card__amount {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-plan-card__interval {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-plan-card__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-semibold);
    font-size: var(--sanvi-font-size-base);
    text-align: center;
  }

  .sanvi-plan-card__cta--primary {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-plan-card__cta--primary:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-plan-card__cta--secondary {
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-plan-card__cta--secondary:hover {
    background: var(--sanvi-color-border-default);
  }

  .sanvi-plan-card__divider {
    border: none;
    border-block-start: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    margin: 0;
  }

  .sanvi-plan-card__feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2-5);
  }

  .sanvi-plan-card__feature-item {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-plan-card__check {
    color: var(--sanvi-color-status-success);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-plan-card__feature-text {
    color: var(--sanvi-color-text-secondary);
    text-transform: capitalize;
  }

  .sanvi-pricing-page__tax-note {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
    margin: 0;
  }

  .sanvi-pricing-page__comparison-section {
    width: 100%;
    margin-block-start: var(--sanvi-spacing-8);
  }

  .sanvi-pricing-page__comparison-header {
    text-align: center;
  }

  .sanvi-pricing-page__comparison-header h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-pricing-page__comparison-header p {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-pricing-page__table-wrapper {
    width: 100%;
    overflow-x: auto;
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-comparison-table {
    width: 100%;
    border-collapse: collapse;
    text-align: start;
  }

  .sanvi-comparison-table th,
  .sanvi-comparison-table td {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-comparison-table__feature-header {
    font-weight: var(--sanvi-font-weight-bold);
    text-align: start;
  }

  .sanvi-comparison-table__plan-header {
    font-weight: var(--sanvi-font-weight-bold);
    text-align: center;
  }

  .sanvi-comparison-table__feature-cell {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-0-5);
    text-align: start;
    font-weight: normal;
  }

  .sanvi-comparison-table__feature-name {
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-comparison-table__feature-desc {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-comparison-table__value-cell {
    text-align: center;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-comparison-table__check {
    color: var(--sanvi-color-status-success);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-comparison-table__cross {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-pricing-page__faq-section {
    width: 100%;
    margin-block-start: var(--sanvi-spacing-8);
  }

  .sanvi-pricing-page__faq-title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    text-align: center;
  }

  .sanvi-pricing-page__faq-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); /* sanvi-tokens-ignore */
    gap: var(--sanvi-spacing-6);
  }

  .sanvi-faq-item {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-faq-item__question {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-faq-item__answer {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    line-height: var(--sanvi-line-height-base);
  }
</style>
