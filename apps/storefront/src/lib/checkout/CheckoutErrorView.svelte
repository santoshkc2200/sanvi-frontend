<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Stack } from '@sanvi/ui'
import { localePath } from '$lib/links'
import { getDeclineMessage } from './decline-codes'

interface Props {
  declineCode?: string | null
  message?: string | null
}

let { declineCode, message }: Props = $props()

const effectiveMessage = $derived(message ?? getDeclineMessage(declineCode))
const retryHref = $derived(localePath('/checkout'))
</script>

<Container size="sm" padding="6">
  <Stack gap="6">
    <header class="sanvi-checkout-error-header">
      <h1 class="sanvi-checkout-error-title">{t['storefront.checkout.error.title']()}</h1>
    </header>

    <Alert variant="error">
      <p>{effectiveMessage}</p>
    </Alert>

    <div class="sanvi-checkout-error-actions">
      <a href={retryHref} class="sanvi-checkout-error-link">
        <Button variant="primary">
          {t['storefront.checkout.error.tryAgain']()}
        </Button>
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
    text-decoration: none;
  }
</style>
