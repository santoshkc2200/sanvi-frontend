<script lang="ts">
import { en, fmt, t } from '@sanvi/i18n'
import { Badge, Cluster, Container, Stack } from '@sanvi/ui'
import { localePath } from '$lib/links'
import type { PriceInterval, PublicPlanView } from '$lib/plans'
import { COMPARISON_FEATURES, calculateAnnualSavingsPercentage, getPriceForPlan } from '$lib/plans'
import type { PageData } from './$types'

interface Props {
  data: PageData
}

let { data }: Props = $props()

let interval = $state<PriceInterval>('month')
let currency = $state<string>('USD')

const plans = $derived<PublicPlanView[]>(data.plans)

const CURRENCY_OPTIONS = [
  { value: 'USD', labelKey: 'marketing.pricing.currency.usd' },
  { value: 'JPY', labelKey: 'marketing.pricing.currency.jpy' },
] as const

const FAQS = [
  { q: 'marketing.pricing.faq.trial.q', a: 'marketing.pricing.faq.trial.a' },
  { q: 'marketing.pricing.faq.changePlan.q', a: 'marketing.pricing.faq.changePlan.a' },
  { q: 'marketing.pricing.faq.tax.q', a: 'marketing.pricing.faq.tax.a' },
  { q: 'marketing.pricing.faq.payment.q', a: 'marketing.pricing.faq.payment.a' },
] as const

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
      // Schema.org structured data stays English for search engines
      // regardless of the rendering locale — read straight from the base
      // catalog, not the current locale's `t`.
      description: en['marketing.pricing.metaDescription'],
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
  <title>{t['marketing.pricing.pageTitle']()}</title>
  <meta name="description" content={t['marketing.pricing.metaDescription']()} />
  <meta property="og:title" content={t['marketing.pricing.pageTitle']()} />
  <meta property="og:description" content={t['marketing.pricing.metaDescription']()} />
  <!-- Structured Data for SEO -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html jsonLdScript}
</svelte:head>

<div class="sanvi-pricing-page">
  <Container size="lg" padding="6">
    <Stack gap="10" align="center">
      <!-- Header -->
      <Stack gap="3" align="center">
        <h1 class="sanvi-pricing-page__title">{t['marketing.pricing.heading']()}</h1>
        <p class="sanvi-pricing-page__subtitle">{t['marketing.pricing.subheading']()}</p>
      </Stack>

      <!-- Controls: Interval & Currency -->
      <Cluster gap="6" justify="center" align="center">
        <fieldset
          class="sanvi-pricing-page__toggle-group"
          aria-label={t['marketing.pricing.billingCycleLabel']()}
        >
          <legend class="sanvi-pricing-page__sr-only">
            {t['marketing.pricing.billingCycleLabel']()}
          </legend>
          <button
            type="button"
            class="sanvi-pricing-page__toggle-button {interval === 'month' ? 'sanvi-pricing-page__toggle-button--active' : ''}"
            onclick={() => { interval = 'month' }}
          >
            {t['marketing.pricing.monthly']()}
          </button>
          <button
            type="button"
            class="sanvi-pricing-page__toggle-button {interval === 'year' ? 'sanvi-pricing-page__toggle-button--active' : ''}"
            onclick={() => { interval = 'year' }}
          >
            {t['marketing.pricing.annual']()}
            {#if maxAnnualSavings() !== null}
              <Badge variant="success">
                {t['marketing.pricing.saveBadge']({ percent: maxAnnualSavings()! })}
              </Badge>
            {/if}
          </button>
        </fieldset>

        <div class="sanvi-pricing-page__currency-selector">
          <label for="currency-select" class="sanvi-pricing-page__currency-label">
            {t['marketing.pricing.currencyLabel']()}:
          </label>
          <select
            id="currency-select"
            class="sanvi-pricing-page__select"
            bind:value={currency}
          >
            {#each CURRENCY_OPTIONS as opt (opt.value)}
              <option value={opt.value}>{t[opt.labelKey]()}</option>
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
                <span class="sanvi-plan-card__popular-badge">
                  {t['marketing.pricing.mostPopular']()}
                </span>
              </div>
            {/if}

            <Stack gap="4">
              <div class="sanvi-plan-card__header">
                <h2 class="sanvi-plan-card__name">{plan.name}</h2>
                {#if price?.trial_days}
                  <Badge variant="info">
                    {t['marketing.pricing.trialBadge']({ days: price.trial_days })}
                  </Badge>
                {/if}
              </div>

              <div class="sanvi-plan-card__price-wrapper">
                {#if price}
                  <span class="sanvi-plan-card__amount">
                    {fmt.money(price.unit_amount_minor, price.currency)}
                  </span>
                  <span class="sanvi-plan-card__interval">
                    {interval === 'month'
                      ? t['marketing.pricing.perMonth']()
                      : t['marketing.pricing.perYear']()}
                  </span>
                {:else}
                  <span class="sanvi-plan-card__amount">—</span>
                {/if}
              </div>

              <a
                class="sanvi-plan-card__cta {isPopular ? 'sanvi-plan-card__cta--primary' : 'sanvi-plan-card__cta--secondary'}"
                href={localePath(`/signup?plan=${plan.key}&interval=${interval}&currency=${currency}`)}
              >
                {price?.trial_days
                  ? t['marketing.pricing.startTrial']()
                  : t['marketing.pricing.getStarted']()}
              </a>

              <hr class="sanvi-plan-card__divider" />

              <ul
                class="sanvi-plan-card__feature-list"
                aria-label={t['marketing.pricing.planFeaturesAria']({ name: plan.name })}
              >
                {#each plan.entitlements as ent (ent.feature_key)}
                  <li class="sanvi-plan-card__feature-item">
                    <span class="sanvi-plan-card__check" aria-hidden="true">
                      {ent.enabled ? '✓' : '—'}
                    </span>
                    <span class="sanvi-plan-card__feature-text">
                      {#if ent.limit !== null && ent.limit !== undefined}
                        {ent.limit} {ent.feature_key.replace('.', ' ')}
                      {:else if ent.enabled && ent.limit === null}
                        {t['marketing.pricing.unlimited']()} {ent.feature_key.replace('.', ' ')}
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

      <p class="sanvi-pricing-page__tax-note">{t['marketing.pricing.taxNote']()}</p>

      <!-- Feature Comparison Table -->
      <div class="sanvi-pricing-page__comparison-section">
        <Stack gap="6" align="center">
          <div class="sanvi-pricing-page__comparison-header">
            <h2>{t['marketing.pricing.featureComparisonTitle']()}</h2>
            <p>{t['marketing.pricing.featureComparisonSubtitle']()}</p>
          </div>

          <div class="sanvi-pricing-page__table-wrapper">
            <table class="sanvi-comparison-table">
              <caption class="sanvi-pricing-page__sr-only">
                {t['marketing.pricing.featureComparisonTitle']()}
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="sanvi-comparison-table__feature-header">
                    {t['marketing.pricing.featureCol']()}
                  </th>
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
                            <strong>{t['marketing.pricing.unlimited']()}</strong>
                          {:else if grant.enabled}
                            <span
                              class="sanvi-comparison-table__check"
                              aria-label={t['marketing.pricing.included']()}
                            >✓</span>
                          {:else}
                            <span
                              class="sanvi-comparison-table__cross"
                              aria-label={t['marketing.pricing.notIncluded']()}
                            >—</span>
                          {/if}
                        {:else}
                          <span
                            class="sanvi-comparison-table__cross"
                            aria-label={t['marketing.pricing.notIncluded']()}
                          >—</span>
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
          <h2 class="sanvi-pricing-page__faq-title">{t['marketing.pricing.faqTitle']()}</h2>
          <div class="sanvi-pricing-page__faq-grid">
            {#each FAQS as faq (faq.q)}
              <div class="sanvi-faq-item">
                <h3 class="sanvi-faq-item__question">{t[faq.q]()}</h3>
                <p class="sanvi-faq-item__answer">{t[faq.a]()}</p>
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
