<script lang="ts">
import CopyButton from '../CopyButton.svelte'

/**
 * The trace-id line and the copy-diagnostics action of an error screen
 * (FR-1106). Deliberately one action producing one paste: a support flow
 * that asks the user to read a trace id aloud loses a character and an
 * afternoon, so the button copies the whole diagnostics text built by the
 * app via `@sanvi/telemetry`'s `buildDiagnosticsPaste` — release, route,
 * tenant, locale, trace id, breadcrumbs in one go.
 *
 * Strings arrive as props: this package renders no catalog of its own.
 * Renders nothing when there is nothing to show — a plain not-found page
 * with no trace id gets neither line nor button, rather than a paste whose
 * trace id is a polite fiction.
 */
interface Props {
  /** The fully rendered trace line (the app localizes `errors.traceId`). */
  traceLine?: string
  /** The one-paste diagnostics text; when set, the copy action renders. */
  diagnosticsText?: string
  copyLabel?: string
  copiedLabel?: string
  class?: string
}

let { traceLine, diagnosticsText, copyLabel, copiedLabel, class: className = '' }: Props = $props()
</script>

{#if traceLine || diagnosticsText}
  <div class="sanvi-error-diagnostics {className}">
    {#if traceLine}
      <p class="sanvi-error-diagnostics__trace">{traceLine}</p>
    {/if}
    {#if diagnosticsText}
      <CopyButton
        value={diagnosticsText}
        label={copyLabel}
        copiedLabel={copiedLabel}
        variant="ghost"
        class="sanvi-error-diagnostics__copy"
      />
    {/if}
  </div>
{/if}

<style>
  .sanvi-error-diagnostics {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    margin-block-start: var(--sanvi-spacing-4);
  }

  .sanvi-error-diagnostics__trace {
    margin: 0;
    text-align: center;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    /* Ids wrap badly at narrow widths — break anywhere beats an overflow. */
    overflow-wrap: anywhere;
  }
</style>
