<script lang="ts">
import EmptyState from './EmptyState.svelte'
import Container from './layout/Container.svelte'
import SuspendedTenantNotice from './SuspendedTenantNotice.svelte'
import RestoreInProgress from './RestoreInProgress.svelte'
import ErrorDiagnostics from './errors/ErrorDiagnostics.svelte'

interface Props {
  title: string
  description?: string
  /** A `423`'s machine-readable reason (`sanvi-backend`'s `locked_problem`) — when set, this renders `SuspendedTenantNotice` instead of the generic view. */
  reason?: 'suspended' | 'provisioning' | 'archived' | 'restoring'
  /** The fully rendered trace-id line (the app localizes `errors.traceId`). */
  traceLine?: string
  /** The one-paste diagnostics text from `buildDiagnosticsPaste`; when set, the copy action renders. */
  diagnosticsText?: string
  copyLabel?: string
  copiedLabel?: string
  retryLabel?: string
  onRetry?: () => void
  billingHref?: string
  /** The public status page URL (TASK-025) — rendered as a link from the generic outage view. */
  statusHref?: string
  statusLinkLabel?: string
  /** Copy for the restore-in-progress state (TASK-025 step 5); the app localizes these. */
  restoreTitle?: string
  restoreDescription?: string
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
  statusHref,
  statusLinkLabel,
  restoreTitle,
  restoreDescription,
}: Props = $props()
</script>

{#if reason === 'restoring'}
  <div data-async-state="error">
    <RestoreInProgress
      title={restoreTitle ?? title}
      description={restoreDescription ?? description}
      {statusHref}
      {statusLinkLabel}
    />
  </div>
{:else if reason}
  <div data-async-state="error">
    <SuspendedTenantNotice
      {reason}
      {traceLine}
      {diagnosticsText}
      {copyLabel}
      {copiedLabel}
      {billingHref}
    />
  </div>
{:else}
  <div data-async-state="error">
    <Container size="md" padding="6">
      {#if retryLabel && onRetry}
        <EmptyState {title} {description}>
          {#snippet action()}
            <div class="sanvi-error-view__actions">
              <button type="button" class="sanvi-error-view__retry" onclick={onRetry}>
                {retryLabel}
              </button>
              {#if statusHref && statusLinkLabel}
                <a class="sanvi-error-view__status-link" href={statusHref}>{statusLinkLabel}</a>
              {/if}
            </div>
          {/snippet}
        </EmptyState>
      {:else}
        <EmptyState {title} {description} />
      {/if}
      {#if statusHref && statusLinkLabel && !(retryLabel && onRetry)}
        <p class="sanvi-error-view__status-line">
          <a class="sanvi-error-view__status-link" href={statusHref}>{statusLinkLabel}</a>
        </p>
      {/if}
      <ErrorDiagnostics {traceLine} {diagnosticsText} {copyLabel} {copiedLabel} />
    </Container>
  </div>
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
  .sanvi-error-view__actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-3);
  }
  .sanvi-error-view__status-link {
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
    font-size: var(--sanvi-font-size-sm);
  }
  .sanvi-error-view__status-line {
    margin: var(--sanvi-spacing-2) 0 0;
    text-align: center;
  }
</style>
