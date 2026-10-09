<script lang="ts" module>
import { defineMeta } from '@storybook/addon-svelte-csf'
import OfflineBanner from './OfflineBanner.svelte'
import StaleContentBanner from './StaleContentBanner.svelte'

const { Story } = defineMeta({
  title: 'Errors/Resilience Banners',
  component: OfflineBanner,
  tags: ['autodocs'],
})
</script>

<Story name="Offline banner">
  {#snippet children()}
    <OfflineBanner
      title="You're offline"
      description="Browsing works from what's on this page. Actions that need our servers won't go through until you're back online."
    />
  {/snippet}
</Story>

<Story name="Stale-content (degraded) banner">
  {#snippet children()}
    <StaleContentBanner
      title="Some content may be out of date"
      description="We're serving a cached copy while our service recovers."
    />
  {/snippet}
</Story>
