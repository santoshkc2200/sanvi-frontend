<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Alert from './Alert.svelte'

const { Story } = defineMeta({
  title: 'Components/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
  },
})
</script>

<Story name="Info" args={{ variant: 'info', title: 'Heads up' }}>
  {#snippet children()}A new version of this course is available.{/snippet}
</Story>

<Story name="Success" args={{ variant: 'success', title: 'Saved' }}>
  {#snippet children()}Your changes were saved.{/snippet}
</Story>

<Story name="Warning" args={{ variant: 'warning', title: 'Trial ending' }}>
  {#snippet children()}Your trial ends in 3 days.{/snippet}
</Story>

<Story name="Error" args={{ variant: 'error', title: 'Payment failed' }}>
  {#snippet children()}We couldn't charge your card. Update your payment method.{/snippet}
</Story>

<Story name="Without title" args={{ variant: 'info' }}>
  {#snippet children()}A short message with no heading.{/snippet}
</Story>
