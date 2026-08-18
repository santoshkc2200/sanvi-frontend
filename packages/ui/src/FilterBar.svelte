<script lang="ts">
import Button from './Button.svelte'
import Input from './Input.svelte'
import Cluster from './layout/Cluster.svelte'
import type { SavedView } from './list-query-state.svelte'
import Select, { type SelectOption } from './Select.svelte'

export type FilterFieldConfig =
  | { type: 'text'; key: string; label: string; placeholder?: string }
  | { type: 'select'; key: string; label: string; options: SelectOption[]; placeholder?: string }
  | { type: 'boolean'; key: string; label: string }

interface Props<F extends Record<string, string | undefined>> {
  fields: FilterFieldConfig[]
  values: F
  onChange: (next: Partial<F>) => void
  onClear?: () => void
  clearLabel?: string
  savedViews?: SavedView<F>[]
  onSaveView?: (label: string) => void
  onApplyView?: (id: string) => void
  onDeleteView?: (id: string) => void
  savedViewsLabel?: string
  saveViewLabel?: string
  savedViewNamePlaceholder?: string
  deleteViewLabel?: string
  class?: string
}

let {
  fields,
  values,
  onChange,
  onClear,
  clearLabel = 'Clear filters',
  savedViews = [],
  onSaveView,
  onApplyView,
  onDeleteView,
  savedViewsLabel = 'Saved views',
  saveViewLabel = 'Save current filters',
  savedViewNamePlaceholder = 'View name',
  deleteViewLabel = 'Delete view',
  class: className = '',
}: Props<Record<string, string | undefined>> = $props()

let newViewName = $state('')

function handleTextChange(key: string, value: string): void {
  onChange({ [key]: value || undefined })
}

function handleSelectChange(key: string, value: string): void {
  onChange({ [key]: value || undefined })
}

function handleBooleanChange(key: string, checked: boolean): void {
  onChange({ [key]: checked ? 'true' : undefined })
}

function handleSaveView(): void {
  if (!newViewName.trim() || !onSaveView) return
  onSaveView(newViewName.trim())
  newViewName = ''
}
</script>

<div class="sanvi-filter-bar {className}">
  <Cluster gap="3" wrap>
    {#each fields as field (field.key)}
      {#if field.type === 'text'}
        <label class="sanvi-filter-bar__field">
          <span class="sanvi-filter-bar__label">{field.label}</span>
          <Input
            value={values[field.key] ?? ''}
            placeholder={field.placeholder}
            oninput={(event) => handleTextChange(field.key, event.currentTarget.value)}
          />
        </label>
      {:else if field.type === 'select'}
        <label class="sanvi-filter-bar__field">
          <span class="sanvi-filter-bar__label">{field.label}</span>
          <Select
            value={values[field.key] ?? ''}
            options={field.options}
            placeholder={field.placeholder}
            onchange={(event) => handleSelectChange(field.key, event.currentTarget.value)}
          />
        </label>
      {:else if field.type === 'boolean'}
        <label class="sanvi-filter-bar__checkbox-field">
          <input
            type="checkbox"
            checked={values[field.key] === 'true'}
            onchange={(event) => handleBooleanChange(field.key, event.currentTarget.checked)}
          />
          <span>{field.label}</span>
        </label>
      {/if}
    {/each}
    {#if onClear}
      <Button variant="ghost" size="sm" onclick={onClear}>{clearLabel}</Button>
    {/if}
  </Cluster>

  {#if onSaveView || savedViews.length > 0}
    <Cluster gap="3" wrap class="sanvi-filter-bar__views">
      <span class="sanvi-filter-bar__label">{savedViewsLabel}</span>
      {#each savedViews as view (view.id)}
        <span class="sanvi-filter-bar__view-chip">
          <button type="button" onclick={() => onApplyView?.(view.id)}>{view.label}</button>
          {#if onDeleteView}
            <button
              type="button"
              class="sanvi-filter-bar__view-remove"
              aria-label="{deleteViewLabel}: {view.label}"
              onclick={() => onDeleteView?.(view.id)}
            >
              &times;
            </button>
          {/if}
        </span>
      {/each}
      {#if onSaveView}
        <Input
          value={newViewName}
          placeholder={savedViewNamePlaceholder}
          oninput={(event) => {
            newViewName = event.currentTarget.value
          }}
        />
        <Button variant="ghost" size="sm" onclick={handleSaveView} disabled={!newViewName.trim()}>
          {saveViewLabel}
        </Button>
      {/if}
    </Cluster>
  {/if}
</div>

<style>
  .sanvi-filter-bar {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-filter-bar__field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    /* Form-field sizing, not a design-tokens value. */
    min-width: 10rem; /* sanvi-tokens-ignore */
  }

  .sanvi-filter-bar__label {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-filter-bar__checkbox-field {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    align-self: flex-end;
  }

  .sanvi-filter-bar__views {
    padding-block-start: var(--sanvi-spacing-2);
    border-block-start: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-filter-bar__view-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-1);
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-filter-bar__view-chip button {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .sanvi-filter-bar__view-remove {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
    line-height: 1;
  }
</style>
