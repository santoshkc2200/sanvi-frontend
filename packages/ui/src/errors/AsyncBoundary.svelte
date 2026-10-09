<script lang="ts">
import type { Snippet } from 'svelte'
import EmptyState from '../EmptyState.svelte'
import ErrorDiagnostics from './ErrorDiagnostics.svelte'

/**
 * The panel-level error boundary (FR-1111, TASK-023 step 3): one failing
 * panel renders this boundary's designed failed view — a recovery action and
 * TASK-020's trace id — and **nothing outside the boundary is affected**.
 * Wrap any region whose children may throw during render (a route page in an
 * SPA shell, a composed panel, a third-party island); never let a blank
 * region stand where a panel failed.
 *
 * Copy arrives as props (this package renders no catalog of its own); the
 * trace line and the one-paste diagnostics text are computed by the app from
 * `@sanvi/telemetry/diagnostics`, exactly as for `ErrorView` — a boundary
 * cannot know them itself, because it also cannot import the data layer.
 *
 * `reset()` re-renders the children; `onRetry` is the caller's refetch. A
 * retry whose data is still broken re-fails into this view — which is the
 * honest outcome, not a second crash.
 */
interface Props {
  children: Snippet
  title: string
  description?: string
  retryLabel?: string
  onRetry?: () => void
  /** The fully rendered trace line (the app localizes `errors.traceId`). */
  traceLine?: string
  /** The one-paste diagnostics text; when set, the copy action renders. */
  diagnosticsText?: string
  copyLabel?: string
  copiedLabel?: string
  /** Observability hook — the app records a breadcrumb or an error report. */
  onError?: (error: unknown) => void
  class?: string
}

let {
  children,
  title,
  description,
  retryLabel,
  onRetry,
  traceLine,
  diagnosticsText,
  copyLabel,
  copiedLabel,
  onError,
  class: className = '',
}: Props = $props()

function retry(reset: () => void): void {
  onRetry?.()
  reset()
}
</script>

<svelte:boundary onerror={(error) => onError?.(error)}>
  {#snippet failed(_error: unknown, reset: () => void)}
    <div class="sanvi-async-boundary {className}" data-async-state="error">
      <EmptyState {title} {description}>
        {#snippet action()}
          {#if retryLabel}
            <button type="button" class="sanvi-async-boundary__retry" onclick={() => retry(reset)}>
              {retryLabel}
            </button>
          {/if}
        {/snippet}
      </EmptyState>
      <ErrorDiagnostics {traceLine} {diagnosticsText} {copyLabel} {copiedLabel} />
    </div>
  {/snippet}
  {@render children()}
</svelte:boundary>

<style>
  .sanvi-async-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .sanvi-async-boundary__retry {
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
  .sanvi-async-boundary__retry:hover {
    background: var(--sanvi-color-background-secondary);
  }
</style>
