<script lang="ts">
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface Props {
  value?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  invalid?: boolean
  describedBy?: string
  class?: string
  onchange?: (event: Event & { currentTarget: HTMLSelectElement }) => void
}

let {
  value = $bindable(''),
  options,
  placeholder,
  disabled = false,
  required = false,
  id,
  name,
  invalid = false,
  describedBy,
  class: className = '',
  onchange,
}: Props = $props()
</script>

<select
  {id}
  {name}
  {disabled}
  {required}
  bind:value
  class="sanvi-select {className}"
  class:sanvi-select--invalid={invalid}
  aria-invalid={invalid || undefined}
  aria-describedby={describedBy}
  {onchange}
>
  {#if placeholder}
    <option value="" disabled selected={value === ''}>{placeholder}</option>
  {/if}
  {#each options as option (option.value)}
    <option value={option.value} disabled={option.disabled}>{option.label}</option>
  {/each}
</select>

<style>
  .sanvi-select {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-select:disabled {
    background: var(--sanvi-color-background-disabled);
    color: var(--sanvi-color-text-disabled);
    cursor: not-allowed;
  }

  .sanvi-select--invalid {
    border-color: var(--sanvi-color-border-error);
  }
</style>
