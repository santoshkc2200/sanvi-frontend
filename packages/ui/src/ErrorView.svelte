<script lang="ts">
import Container from './layout/Container.svelte'
import EmptyState from './EmptyState.svelte'
import SuspendedTenantNotice from './SuspendedTenantNotice.svelte'

interface Props {
  title: string
  description?: string
  /** A `423`'s machine-readable reason (`sanvi-backend`'s `locked_problem`) — when set, this renders `SuspendedTenantNotice` instead of the generic view. */
  reason?: 'suspended' | 'provisioning' | 'archived'
  traceId?: string
  retryLabel?: string
  onRetry?: () => void
  billingHref?: string
}

let { title, description, reason, traceId, retryLabel, onRetry, billingHref }: Props = $props()

const COPY = {
  traceIdLabel: (id: string) => `Reference: ${id}`,
}
</script>

{#if reason}
  <SuspendedTenantNotice {reason} {traceId} {billingHref} />
{:else}
  <Container size="md" padding="6">
    {#if retryLabel && onRetry}
      <EmptyState {title} {description}>
        {#snippet action()}
          <button type="button" class="sanvi-error-view__retry" onclick={onRetry}>{retryLabel}</button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState {title} {description} />
    {/if}
    {#if traceId}
      <p class="sanvi-error-view__trace">{COPY.traceIdLabel(traceId)}</p>
    {/if}
  </Container>
{/if}

<style>
  .sanvi-error-view__retry {
    display: inline-flex;
    align-items: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: transparent;
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
    cursor: pointer;
  }
  .sanvi-error-view__retry:hover {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-error-view__trace {
    margin-block-start: var(--sanvi-spacing-4);
    text-align: center;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
