<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import QuotaExceededDialog from './QuotaExceededDialog.svelte'

const { Story } = defineMeta({
  title: 'Components/QuotaExceededDialog',
  component: QuotaExceededDialog,
  tags: ['autodocs'],
})
</script>

<Story
  name="With Counts"
  args={{
    open: true,
    feature: 'team members',
    currentUsage: 10,
    limit: 10,
    upgradeHref: '/billing',
  }}
/>
