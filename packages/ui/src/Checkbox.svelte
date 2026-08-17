<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  checked?: boolean
  indeterminate?: boolean
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  value?: string
  class?: string
  onchange?: (event: Event & { currentTarget: HTMLInputElement }) => void
  children: Snippet
}

let {
  checked = $bindable(false),
  indeterminate = false,
  disabled = false,
  required = false,
  id,
  name,
  value,
  class: className = '',
  onchange,
  children,
}: Props = $props()

let inputEl: HTMLInputElement | undefined = $state()

$effect(() => {
  if (inputEl) inputEl.indeterminate = indeterminate
})

const uid = $props.id()
const resolvedId = $derived(id ?? uid)
</script>

<label class="sanvi-checkbox {className}" class:sanvi-checkbox--disabled={disabled}>
  <input
    bind:this={inputEl}
    id={resolvedId}
    {name}
    {value}
    {disabled}
    {required}
    type="checkbox"
    class="sanvi-checkbox__input"
    bind:checked
    {onchange}
  />
  <span class="sanvi-checkbox__label">{@render children()}</span>
</label>

<style>
  .sanvi-checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    cursor: pointer;
  }

  .sanvi-checkbox--disabled {
    cursor: not-allowed;
    color: var(--sanvi-color-text-disabled);
  }

  .sanvi-checkbox__input {
    inline-size: var(--sanvi-spacing-4);
    block-size: var(--sanvi-spacing-4);
    accent-color: var(--sanvi-color-solid-primary-base);
  }
</style>
