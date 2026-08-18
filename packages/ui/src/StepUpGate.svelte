<script lang="ts">
import type { Snippet } from 'svelte'
import Button from './Button.svelte'
import EmptyState from './EmptyState.svelte'

interface Props {
  /** Whether the caller's session already satisfies the fresh-MFA requirement (`aal2` re-authenticated within the last few minutes) — computed by the app, since `@sanvi/ui` never reads session state itself. */
  fresh: boolean
  title?: string
  description?: string
  actionLabel?: string
  onStepUp: () => void
  children: Snippet
}

let {
  fresh,
  title = 'Re-authentication required',
  description = 'This action needs a fresh sign-in confirmation before it can proceed.',
  actionLabel = 'Re-authenticate',
  onStepUp,
  children,
}: Props = $props()
</script>

{#if fresh}
  {@render children()}
{:else}
  <EmptyState {title} {description}>
    {#snippet action()}
      <Button variant="primary" onclick={onStepUp}>{actionLabel}</Button>
    {/snippet}
  </EmptyState>
{/if}
