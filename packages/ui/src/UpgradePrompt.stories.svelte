<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import UpgradePrompt from './UpgradePrompt.svelte'

const { Story } = defineMeta({
  title: 'Components/UpgradePrompt',
  component: UpgradePrompt,
  tags: ['autodocs'],
})
</script>

<Story name="Default" args={{ feature: 'domains.custom', upgradeHref: '/billing' }} />

<Story
  name="Custom Copy"
  args={{
    title: 'Unlock Unlimited Members',
    description: 'Collaborate with your whole team by upgrading to the Professional plan.',
    ctaLabel: 'Upgrade to Pro',
    upgradeHref: '/billing',
  }}
/>
