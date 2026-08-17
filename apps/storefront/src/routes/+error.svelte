<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'
import { page } from '$app/state'

const COPY = {
  titleSuffix: 'Sanvi',
  notFoundTitle: 'Page not found',
  errorTitle: 'Something went wrong',
  defaultDescription: 'Try reloading the page.',
  retry: 'Try again',
  traceIdLabel: (id: string) => `Reference: ${id}`,
}

const title = $derived(page.status === 404 ? COPY.notFoundTitle : COPY.errorTitle)
const description = $derived(page.error?.message ?? COPY.defaultDescription)
const traceId = $derived(page.error?.traceId)
</script>

<svelte:head>
  <title>{page.status} — {COPY.titleSuffix}</title>
</svelte:head>

<Container size="md" padding="6">
  <EmptyState {title} {description}>
    {#snippet action()}
      <a href={page.url.pathname}>{COPY.retry}</a>
    {/snippet}
  </EmptyState>
  {#if traceId}
    <p class="storefront-error__trace">{COPY.traceIdLabel(traceId)}</p>
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
