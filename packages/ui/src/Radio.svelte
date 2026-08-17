<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  /** Bind the same variable across every Radio in a group; compared against `value`. */
  group?: string
  value: string
  disabled?: boolean
  required?: boolean
  id?: string
  name: string
  class?: string
  onchange?: (event: Event & { currentTarget: HTMLInputElement }) => void
  children: Snippet
}

let {
  group = $bindable(''),
  value,
  disabled = false,
  required = false,
  id,
  name,
  class: className = '',
  onchange,
  children,
}: Props = $props()

const uid = $props.id()
const resolvedId = $derived(id ?? uid)
</script>

<label class="sanvi-radio {className}" class:sanvi-radio--disabled={disabled}>
  <input
    id={resolvedId}
    {name}
    {value}
    {disabled}
    {required}
    type="radio"
    class="sanvi-radio__input"
    bind:group
    {onchange}
  />
  <span class="sanvi-radio__label">{@render children()}</span>
</label>

<style>
  .sanvi-radio {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    cursor: pointer;
  }

  .sanvi-radio--disabled {
    cursor: not-allowed;
    color: var(--sanvi-color-text-disabled);
  }

  .sanvi-radio__input {
    inline-size: var(--sanvi-spacing-4);
    block-size: var(--sanvi-spacing-4);
    accent-color: var(--sanvi-color-solid-primary-base);
  }
</style>
