<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import PastDueBanner from './PastDueBanner.svelte'

const { Story } = defineMeta({
  title: 'Components/PastDueBanner',
  component: PastDueBanner,
  tags: ['autodocs'],
})
</script>

<Story name="With Grace Period" args={{ daysRemaining: 3, portalHref: '/billing' }} />

<Story name="Standard" args={{ portalHref: '/billing' }} />
