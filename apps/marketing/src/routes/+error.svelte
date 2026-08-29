<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, EmptyState } from '@sanvi/ui'
import { page } from '$app/state'

const titleSuffix = 'Sanvi'

const title = $derived(
  page.status === 404 ? t['errors.notFound.title']() : t['errors.generic.title'](),
)
const description = $derived(page.error?.message ?? t['errors.default.description']())
</script>

<svelte:head>
  <title>{page.status} — {titleSuffix}</title>
</svelte:head>

<Container size="md" padding="6">
  <EmptyState {title} {description}>
    {#snippet action()}
      <a href={page.url.pathname}>{t['common.retry']()}</a>
    {/snippet}
  </EmptyState>
</Container>
