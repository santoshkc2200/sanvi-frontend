<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Stack from './Stack.svelte'

const { Story } = defineMeta({
  title: 'Layout/Stack',
  component: Stack,
  tags: ['autodocs'],
})
</script>

<Story name="Default" args={{ gap: '4' }}>
  {#snippet children()}
    <div style="padding: 1rem; background: var(--sanvi-color-background-secondary);">Item 1</div>
    <div style="padding: 1rem; background: var(--sanvi-color-background-secondary);">Item 2</div>
    <div style="padding: 1rem; background: var(--sanvi-color-background-secondary);">Item 3</div>
  {/snippet}
</Story>

<Story name="Tight gap, centered" args={{ gap: '1', align: 'center' }}>
  {#snippet children()}
    <div style="padding: 0.5rem; background: var(--sanvi-color-background-secondary);">A</div>
    <div style="padding: 0.5rem; background: var(--sanvi-color-background-secondary);">
      Item with more content
    </div>
  {/snippet}
</Story>
