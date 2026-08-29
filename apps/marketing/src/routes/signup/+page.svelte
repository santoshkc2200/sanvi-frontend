<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, Stack } from '@sanvi/ui'
import type { PageData } from './$types'

interface Props {
  data: PageData
}

let { data }: Props = $props()

// Same display capitalization as before ("starter" → "Starter"); the catalog
// message owns everything around it.
const planLabel = $derived(data.selectedPlan.charAt(0).toUpperCase() + data.selectedPlan.slice(1))

const adminOnboardingUrl = $derived(
  `/onboarding?plan=${encodeURIComponent(data.selectedPlan)}&interval=${encodeURIComponent(data.selectedInterval)}&currency=${encodeURIComponent(data.selectedCurrency)}`,
)
</script>

<svelte:head>
  <title>{t['marketing.signup.title']()}</title>
  <meta name="description" content={t['marketing.signup.metaDescription']()} />
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6" align="center">
    <Stack gap="2" align="center">
      <h1 class="sanvi-signup__title">{t['marketing.signup.heading']()}</h1>
      <p class="sanvi-signup__subtitle">
        {t['marketing.signup.subheading']({ plan: planLabel, interval: data.selectedInterval })}
      </p>
    </Stack>

    <div class="sanvi-signup__card">
      <Stack gap="4">
        <a class="sanvi-signup__cta" href={adminOnboardingUrl}>
          {t['marketing.signup.continueCta']()}
        </a>

        <div class="sanvi-signup__footer">
          <span>{t['marketing.signup.signInPrompt']()}</span>
          <!-- rel="external" prevents client router interception for cross-route link -->
          <a class="sanvi-signup__link" href="/login" rel="external">
            {t['marketing.signup.signInLink']()}
          </a>
        </div>
      </Stack>
    </div>
  </Stack>
</Container>

<style>
  .sanvi-signup__title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    text-align: center;
  }

  .sanvi-signup__subtitle {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-signup__card {
    width: 100%;
    padding: var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-signup__cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-semibold);
    font-size: var(--sanvi-font-size-base);
    text-align: center;
  }

  .sanvi-signup__cta:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-signup__footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-signup__link {
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
  }
</style>
