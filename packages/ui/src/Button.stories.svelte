<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Button from './Button.svelte'

const { Story } = defineMeta({
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
})
</script>

<Story name="Primary" args={{ variant: 'primary' }}>
  {#snippet children()}Save changes{/snippet}
</Story>

<Story name="Secondary" args={{ variant: 'secondary' }}>
  {#snippet children()}Learn more{/snippet}
</Story>

<Story name="Danger" args={{ variant: 'danger' }}>
  {#snippet children()}Delete account{/snippet}
</Story>

<Story name="Ghost" args={{ variant: 'ghost' }}>
  {#snippet children()}Cancel{/snippet}
</Story>

<Story name="Loading" args={{ loading: true, loadingLabel: 'Saving' }}>
  {#snippet children()}Save changes{/snippet}
</Story>

<Story name="Disabled" args={{ disabled: true }}>
  {#snippet children()}Save changes{/snippet}
</Story>
