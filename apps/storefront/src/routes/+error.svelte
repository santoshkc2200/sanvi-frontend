<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, EmptyState } from '@sanvi/ui'
import { page } from '$app/state'

const title = $derived(
  page.status === 404 ? t['errors.notFound.title']() : t['errors.generic.title'](),
)
const description = $derived(page.error?.message ?? t['errors.default.description']())
const traceId = $derived(page.error?.traceId)
</script>

<svelte:head>
  <title>{page.status} — {t['errors.brand']()}</title>
</svelte:head>

<Container size="md" padding="6">
  <EmptyState {title} {description}>
    {#snippet action()}
      <a href={page.url.pathname}>{t['common.retry']()}</a>
    {/snippet}
  </EmptyState>
  {#if traceId}
    <p class="storefront-error__trace">{t['errors.traceId']({ id: traceId })}</p>
  {/if}
</Container>

<style>
  .storefront-error__trace {
    margin-block-start: var(--sanvi-spacing-4);
    text-align: center;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
