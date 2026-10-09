<script lang="ts" module>
import { defineMeta } from '@storybook/addon-svelte-csf'
import AsyncBoundary from './errors/AsyncBoundary.svelte'

const { Story } = defineMeta({
  title: 'Errors/AsyncBoundary',
  component: AsyncBoundary,
  tags: ['autodocs'],
})

// The failed story's children throw during render, the way a real broken
// panel would — a property access on nothing.
const broken = undefined as unknown as { length: number }
</script>

<Story name="Happy path">
  {#snippet children()}
    <AsyncBoundary title="Panel failed">
      <p>Panel content renders normally.</p>
    </AsyncBoundary>
  {/snippet}
</Story>

<Story name="Failed panel — recovery action and trace id">
  {#snippet children()}
    <AsyncBoundary
      title="Panel failed"
      description="This panel could not load."
      retryLabel="Try again"
      traceLine="Reference: 0af7c6d5e4b39a82b1d0c4f7a9e8d7c6"
      diagnosticsText={'Sanvi diagnostics\ntrace_id: 0af7c6d5…'}
      copyLabel="Copy diagnostics"
    >
      <p>{broken.length} items</p>
    </AsyncBoundary>
  {/snippet}
</Story>
