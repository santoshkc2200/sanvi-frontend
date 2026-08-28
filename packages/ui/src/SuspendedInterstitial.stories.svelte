<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import SuspendedInterstitial from './SuspendedInterstitial.svelte'

const { Story } = defineMeta({
  title: 'Components/SuspendedInterstitial',
  component: SuspendedInterstitial,
  tags: ['autodocs'],
})
</script>

<Story name="Default" args={{ reason: 'billing', portalHref: '/billing' }} />
