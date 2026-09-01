<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Container, Spinner, Stack } from '@sanvi/ui'

interface Props {
  delayed?: boolean
}

let { delayed = false }: Props = $props()
</script>

<Container size="sm" padding="6">
  <div class="sanvi-confirming-wrapper" aria-live="polite">
    <Stack gap="6" align="center">
      <Spinner size="lg" label={t['storefront.checkout.confirming.title']()} />

      <h1 class="sanvi-confirming-title">{t['storefront.checkout.confirming.title']()}</h1>

      <p class="sanvi-confirming-body">{t['storefront.checkout.confirming.body']()}</p>

      {#if delayed}
        <Alert variant="warning">
          <p>{t['storefront.checkout.confirming.delayedNotice']()}</p>
        </Alert>
      {/if}
    </Stack>
  </div>
</Container>

<style>
  .sanvi-confirming-wrapper {
    text-align: center;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-4);
  }

  .sanvi-confirming-title {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-confirming-body {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    line-height: var(--sanvi-line-height-relaxed);
  }
</style>
