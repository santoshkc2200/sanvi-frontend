<script lang="ts">
import Button from './Button.svelte'
import Container from './layout/Container.svelte'
import Stack from './layout/Stack.svelte'

interface Props {
  reason?: string
  portalHref?: string
  onOpenPortal?: () => void
  supportHref?: string
  class?: string
}

let {
  reason,
  portalHref = '/billing',
  onOpenPortal,
  supportHref = 'mailto:support@sanvi.app',
  class: className = '',
}: Props = $props()

const COPY = {
  title: 'Workspace suspended',
  reasonLabel: (r: string) => `Reason: ${r}`,
  description:
    'Access to this workspace has been paused because a required subscription payment is past due. Your data, configuration, and courses are fully preserved.',
  subDescription:
    'To restore immediate access for you and your team, please update your billing details or reactivate your subscription.',
  portalCta: 'Manage billing & reactivate',
  supportPrompt: 'Have questions or need assistance?',
  supportCta: 'Contact support',
}
</script>

<div class="sanvi-suspended-interstitial {className}" role="alert">
  <Container size="md" padding="6">
    <div class="sanvi-suspended-interstitial__card">
      <Stack gap="5" align="center">
        <div class="sanvi-suspended-interstitial__badge" aria-hidden="true">
          !
        </div>
        <Stack gap="2" align="center">
          <h1 class="sanvi-suspended-interstitial__title">{COPY.title}</h1>
          {#if reason}
            <span class="sanvi-suspended-interstitial__reason">{COPY.reasonLabel(reason)}</span>
          {/if}
        </Stack>

        <div class="sanvi-suspended-interstitial__body">
          <p>{COPY.description}</p>
          <p>{COPY.subDescription}</p>
        </div>

        <div class="sanvi-suspended-interstitial__actions">
          {#if onOpenPortal}
            <Button variant="primary" onclick={onOpenPortal}>
              {COPY.portalCta}
            </Button>
          {:else}
            <a class="sanvi-suspended-interstitial__portal-link" href={portalHref}>
              {COPY.portalCta}
            </a>
          {/if}
        </div>

        <div class="sanvi-suspended-interstitial__support">
          <span>{COPY.supportPrompt}</span>
          <a class="sanvi-suspended-interstitial__support-link" href={supportHref}>
            {COPY.supportCta}
          </a>
        </div>
      </Stack>
    </div>
  </Container>
</div>

<style>
  .sanvi-suspended-interstitial {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-suspended-interstitial__card {
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-xl);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    text-align: center;
  }

  .sanvi-suspended-interstitial__badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-12);
    height: var(--sanvi-spacing-12);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-status-warning);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-suspended-interstitial__title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-suspended-interstitial__reason {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-suspended-interstitial__body {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
    /* Comfort reading measure for explanatory text */
    max-width: 32rem; /* sanvi-tokens-ignore */
  }

  .sanvi-suspended-interstitial__body p {
    margin: 0;
  }

  .sanvi-suspended-interstitial__actions {
    margin-block-start: var(--sanvi-spacing-2);
  }

  .sanvi-suspended-interstitial__portal-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-semibold);
    font-size: var(--sanvi-font-size-base);
  }

  .sanvi-suspended-interstitial__portal-link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-suspended-interstitial__support {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    margin-block-start: var(--sanvi-spacing-2);
  }

  .sanvi-suspended-interstitial__support-link {
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
  }
</style>
