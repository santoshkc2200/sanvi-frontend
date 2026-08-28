<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import TrialBanner from './TrialBanner.svelte'

const { Story } = defineMeta({
  title: 'Components/TrialBanner',
  component: TrialBanner,
  tags: ['autodocs'],
})
</script>

<Story name="Standard" args={{ daysRemaining: 5, trialEnd: '2026-09-02' }} />

<Story name="Urgent" args={{ daysRemaining: 1, trialEnd: '2026-08-29', isUrgent: true }} />
