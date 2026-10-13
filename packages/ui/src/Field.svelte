<script lang="ts">
import type { Snippet } from 'svelte'

export interface FieldControlProps {
  id: string
  describedBy: string | undefined
  invalid: boolean
  /**
   * Mirrors the Field's `required` so controls can spread it onto the
   * native element — required-ness is conveyed programmatically, never by
   * the visual asterisk alone (TASK-027).
   */
  required: boolean
}

interface Props {
  label: string
  hint?: string
  error?: string
  required?: boolean
  class?: string
  /**
   * Overrides the generated control id — for a form that also renders an
   * error summary, the summary's links must target the same id the control
   * carries. Undefined keeps the generated unique id.
   */
  id?: string
  children: Snippet<[FieldControlProps]>
}

let { label, hint, error, required = false, class: className = '', id, children }: Props = $props()

const uid = $props.id()
const controlId = $derived(id ?? uid)
// Only an id when the hint actually renders (below, `hint && !error`) —
// otherwise aria-describedby points at an id that isn't in the DOM.
const hintId = $derived(hint && !error ? `${controlId}-hint` : undefined)
const errorId = $derived(error ? `${controlId}-error` : undefined)
const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined)
</script>

<div class="sanvi-field {className}">
  <label class="sanvi-field__label" for={controlId}>
    {label}{#if required}<span aria-hidden="true"> *</span>{/if}
  </label>
  {@render children({ id: controlId, describedBy, invalid: Boolean(error), required })}
  {#if hint && !error}
    <p id={hintId} class="sanvi-field__hint">{hint}</p>
  {/if}
  {#if error}
    <p id={errorId} class="sanvi-field__error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .sanvi-field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-field__label {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-field__hint {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-field__error {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-status-error);
  }
</style>
