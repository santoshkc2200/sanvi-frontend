<script lang="ts">
import { getTenantContext } from '@sanvi/tenant'
import { Container, EmptyState } from '@sanvi/ui'

const tenant = getTenantContext()

const COPY = {
  emptyTitle: 'No storefront content yet',
  emptyDescription: 'Catalog and page content are wired up starting in a later phase.',
}
</script>

<svelte:head>
  <title>{tenant?.display_name ?? 'Sanvi Storefront'}</title>
</svelte:head>

<Container size="lg" padding="6">
  <EmptyState title={tenant?.display_name ?? COPY.emptyTitle} description={COPY.emptyDescription} />
</Container>
