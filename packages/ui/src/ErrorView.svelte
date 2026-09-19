<script lang="ts">
import EmptyState from './EmptyState.svelte'
import Container from './layout/Container.svelte'
import SuspendedTenantNotice from './SuspendedTenantNotice.svelte'
import ErrorDiagnostics from './errors/ErrorDiagnostics.svelte'

interface Props {
  title: string
  description?: string
  /** A `423`'s machine-readable reason (`sanvi-backend`'s `locked_problem`) — when set, this renders `SuspendedTenantNotice` instead of the generic view. */
  reason?: 'suspended' | 'provisioning' | 'archived'
  /** The fully rendered trace-id line (the app localizes `errors.traceId`). */
  traceLine?: string
  /** The one-paste diagnostics text from `buildDiagnosticsPaste`; when set, the copy action renders. */
  diagnosticsText?: string
  copyLabel?: string
  copiedLabel?: string
  retryLabel?: string
  onRetry?: () => void
  billingHref?: string
}

let {
  title,
  description,
  reason,
  traceLine,
  diagnosticsText,
  copyLabel,
  copiedLabel,
  retryLabel,
  onRetry,
  billingHref,
}: Props = $props()
</script>

{#if reason}
  <SuspendedTenantNotice
    {reason}
    {traceLine}
    {diagnosticsText}
    {copyLabel}
    {copiedLabel}
    {billingHref}
  />
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
    <ErrorDiagnostics {traceLine} {diagnosticsText} {copyLabel} {copiedLabel} />
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
</style>
