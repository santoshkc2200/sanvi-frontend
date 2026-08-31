<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import CopyButton from './CopyButton.svelte'

const { Story } = defineMeta({
  title: 'Components/CopyButton',
  component: CopyButton,
  tags: ['autodocs'],
})
</script>

<Story name="Default" args={{ value: '_sanvi-challenge=abc123xyz' }} />

<Story
  name="Custom labels"
  args={{ value: '192.0.2.1', label: 'Copy IP', copiedLabel: 'IP copied!' }}
/>

<Story
  name="Primary variant"
  args={{ value: 'cname.sanvi.app', variant: 'primary', size: 'md' }}
/>
