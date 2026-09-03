<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Container, Stack } from '@sanvi/ui'
import { localePath } from '$lib/links'
import { getDeclineMessage } from './decline-codes'

interface Props {
  title?: string | null
  declineCode?: string | null
  message?: string | null
}

let { title, declineCode, message }: Props = $props()

const effectiveTitle = $derived(title ?? t['storefront.checkout.error.title']())
const effectiveMessage = $derived(message ?? getDeclineMessage(declineCode))
const retryHref = $derived(localePath('/checkout'))
</script>

<Container size="sm" padding="6">
  <Stack gap="6">
    <header class="sanvi-checkout-error-header">
      <h1 class="sanvi-checkout-error-title">{effectiveTitle}</h1>
    </header>

    <Alert variant="error">
      <p>{effectiveMessage}</p>
    </Alert>

    <div class="sanvi-checkout-error-actions">
      <a href={retryHref} class="sanvi-checkout-error-link">
        {t['storefront.checkout.error.tryAgain']()}
      </a>
    </div>
  </Stack>
</Container>

<style>
  .sanvi-checkout-error-header {
    text-align: center;
    padding-bottom: var(--sanvi-spacing-4);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-checkout-error-title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-danger);
  }

  .sanvi-checkout-error-actions {
    display: flex;
    justify-content: center;
  }

  .sanvi-checkout-error-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-md);
    line-height: var(--sanvi-line-height-tight);
    transition: background-color 0.12s ease;
  }

  .sanvi-checkout-error-link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }
</style>
