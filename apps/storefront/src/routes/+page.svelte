<script lang="ts">
import { t } from '@sanvi/i18n'
import { getTenantContext } from '@sanvi/tenant'
import { Container, EmptyState } from '@sanvi/ui'

const tenant = getTenantContext()
</script>

<svelte:head>
  <title>{tenant?.display_name ?? t['storefront.home.fallbackTitle']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <EmptyState
    title={tenant?.display_name ?? t['storefront.home.emptyTitle']()}
    description={t['storefront.home.emptyDescription']()}
  />
</Container>
