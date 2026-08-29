<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Spacer from './Spacer.svelte'

const { Story } = defineMeta({
  title: 'Blocks/Spacer',
  component: Spacer,
  tags: ['autodocs'],
})
</script>

<Story name="Block Spacer (Large)" args={{ size: "8", axis: "block" }} />

<Story name="Inline Spacer (Medium)" args={{ size: "4", axis: "inline" }} />
