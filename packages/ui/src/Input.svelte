<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements'

interface Props {
  value?: string
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'
  /** Hint for virtual keyboards on text-typed inputs (e.g. `numeric` for minor-unit amounts). */
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  id?: string
  name?: string
  autocomplete?: HTMLInputAttributes['autocomplete']
  invalid?: boolean
  describedBy?: string
  class?: string
  oninput?: (event: Event & { currentTarget: HTMLInputElement }) => void
  onblur?: (event: FocusEvent) => void
}

let {
  value = $bindable(''),
  type = 'text',
  inputmode,
  placeholder,
  disabled = false,
  readonly = false,
  required = false,
  id,
  name,
  autocomplete,
  invalid = false,
  describedBy,
  class: className = '',
  oninput,
  onblur,
}: Props = $props()
</script>

<input
  {id}
  {name}
  {type}
  {inputmode}
  {placeholder}
  {disabled}
  {readonly}
  {required}
  {autocomplete}
  bind:value
  class="sanvi-input {className}"
  class:sanvi-input--invalid={invalid}
  aria-invalid={invalid || undefined}
  aria-describedby={describedBy}
  {oninput}
  {onblur}
/>

<style>
  .sanvi-input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-input::placeholder {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-input:disabled {
    background: var(--sanvi-color-background-disabled);
    color: var(--sanvi-color-text-disabled);
    cursor: not-allowed;
  }

  .sanvi-input--invalid {
    border-color: var(--sanvi-color-border-error);
  }
</style>
