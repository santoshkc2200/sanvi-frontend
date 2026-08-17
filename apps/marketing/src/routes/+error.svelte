<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'
import { page } from '$app/state'

const COPY = {
  titleSuffix: 'Sanvi',
  notFoundTitle: 'Page not found',
  errorTitle: 'Something went wrong',
  defaultDescription: 'Try reloading the page, or head back to the homepage.',
}

const title = $derived(page.status === 404 ? COPY.notFoundTitle : COPY.errorTitle)
const description = $derived(page.error?.message ?? COPY.defaultDescription)
</script>

<svelte:head>
  <title>{page.status} — {COPY.titleSuffix}</title>
</svelte:head>

<Container size="md" padding="6">
  <EmptyState {title} {description} />
</Container>
