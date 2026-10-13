<script lang="ts">
/**
 * The form error summary (TASK-027 steps 2 & 4): one `role="alert"` block at
 * the top of a form linking every offending field, so a screen-reader or
 * keyboard user hears the whole failure at once and can jump straight to
 * each input — the summary is the audible form of the inline field errors,
 * never a replacement for them.
 *
 * Item order renders verbatim: the caller passes backend field issues in the
 * backend's pinned order (`ApiError.fieldIssues`), so a resubmit lists
 * identically and keyboard position survives the refresh.
 *
 * `@sanvi/ui` stays copy-free — the title comes in as a prop.
 */
interface Props {
  items: { id: string; label?: string; message: string }[]
  title?: string
  class?: string
}

let { items, title = 'Fix the following errors', class: className = '' }: Props = $props()

let container: HTMLDivElement | undefined = $state()

/**
 * Moves focus to the summary itself — the standard failed-submit behavior
 * (GDS pattern): the submit handler calls this instead of leaving focus on
 * the button, so the next Tab/arrow press starts from the errors.
 */
export function focusSummary(): void {
  container?.focus()
}

function jumpToField(event: MouseEvent, id: string): void {
  // Hash navigation fights programmatic focus (and re-scrolls); the link is
  // a real anchor for no-JS semantics, but activation focuses the control.
  event.preventDefault()
  const control = document.getElementById(id)
  if (!control) return
  control.scrollIntoView?.({ block: 'center' })
  control.focus()
}
</script>

{#if items.length > 0}
  <div
    class="sanvi-error-summary {className}"
    role="alert"
    tabindex="-1"
    bind:this={container}
  >
    <p class="sanvi-error-summary__title">{title}</p>
    <ul class="sanvi-error-summary__list">
      {#each items as item (item.id)}
        <li>
          <a
            class="sanvi-error-summary__link"
            href="#{item.id}"
            onclick={(event) => jumpToField(event, item.id)}
          >
            {#if item.label}{item.label}: {/if}{item.message}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .sanvi-error-summary {
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-error);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }
  .sanvi-error-summary:focus {
    outline: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-focus);
    outline-offset: var(--sanvi-spacing-1);
  }

  .sanvi-error-summary__title {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-error-summary__list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-error-summary__link {
    color: var(--sanvi-color-status-error);
    font-size: var(--sanvi-font-size-sm);
  }
</style>
