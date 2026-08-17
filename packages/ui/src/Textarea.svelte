<script lang="ts">
interface Props {
  value?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  id?: string
  name?: string
  invalid?: boolean
  describedBy?: string
  class?: string
  oninput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void
}

let {
  value = $bindable(''),
  placeholder,
  disabled = false,
  readonly = false,
  required = false,
  rows = 4,
  id,
  name,
  invalid = false,
  describedBy,
  class: className = '',
  oninput,
}: Props = $props()
</script>

<textarea
  {id}
  {name}
  {placeholder}
  {disabled}
  {readonly}
  {required}
  {rows}
  bind:value
  class="sanvi-textarea {className}"
  class:sanvi-textarea--invalid={invalid}
  aria-invalid={invalid || undefined}
  aria-describedby={describedBy}
  {oninput}
></textarea>

<style>
  .sanvi-textarea {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
    font-family: inherit;
    resize: vertical;
  }

  .sanvi-textarea:disabled {
    background: var(--sanvi-color-background-disabled);
    color: var(--sanvi-color-text-disabled);
    cursor: not-allowed;
  }

  .sanvi-textarea--invalid {
    border-color: var(--sanvi-color-border-error);
  }
</style>
