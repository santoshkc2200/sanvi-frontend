<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'
import { page } from '$app/state'

const COPY = {
  title: 'Sanvi Storefront',
  emptyTitle: 'No storefront content yet',
  emptyDescription: (locale: string) =>
    `Tenant resolution lands in phase 01 — this placeholder is currently rendering for locale "${locale}".`,
}

const description = $derived(COPY.emptyDescription(page.data['locale'] ?? 'en'))
</script>

<svelte:head>
  <title>{COPY.title}</title>
</svelte:head>

<Container size="lg" padding="6">
  <EmptyState title={COPY.emptyTitle} {description} />
</Container>
