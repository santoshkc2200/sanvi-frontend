<script lang="ts">
import Button from './Button.svelte'
import Checkbox from './Checkbox.svelte'

/**
 * The preference centre's purpose rows, shared by the storefront privacy
 * centre and the preference dialog. The control's *semantics* come from the
 * app, which derives them from the backend's `consent_model`:
 *
 * - opt-in rows default to unchecked and mean "allow this purpose";
 * - notice-and-opt-out rows default to allowed, and show the decision's
 *   source (your choice / a browser signal / the default) next to the
 *   control.
 *
 * Rows a browser privacy signal (GPC) holds down render locked, with an
 * explicit override action — the store refuses a quiet flip.
 */
export interface PreferenceRow {
  key: string
  label: string
  /** Plain-language description of the purpose. */
  description: string
  /** The concrete consequence of enabling it (who sees what). */
  consequence: string
  /** Vendors involved, from the sub-processor list (one string). */
  vendors?: string
  allowed: boolean
  /** Human text for the decision's provenance ("Your choice", "Browser signal", …). */
  source?: string
  /** True when a browser privacy signal holds this row down. */
  locked?: boolean
  /** Human text explaining why the row is locked. */
  lockedNote?: string
}

interface Props {
  /** Accessible group label, e.g. "Privacy preferences". */
  label: string
  rows: PreferenceRow[]
  sensitiveTitle?: string
  sensitiveRows?: PreferenceRow[]
  /** Shown when a GPC signal was detected and applied, as a status row. */
  gpcNote?: string
  overrideLabel?: string
  onchange: (key: string, allowed: boolean) => void
  onOverride?: (key: string) => void
  class?: string
}

let {
  label,
  rows,
  sensitiveTitle,
  sensitiveRows = [],
  gpcNote,
  overrideLabel = 'Override signal',
  onchange,
  onOverride,
  class: className = '',
}: Props = $props()

const uid = $props.id()

function rowId(key: string): string {
  return `sanvi-preference-${uid}-${key}`
}
</script>

<div class="sanvi-preferences {className}" role="group" aria-label={label}>
  {#if gpcNote}
    <p class="sanvi-preferences__gpc" role="status">{gpcNote}</p>
  {/if}

  <ul class="sanvi-preferences__list">
    {#each rows as row (row.key)}
      <li class="sanvi-preferences__row">
        <div class="sanvi-preferences__control">
          <Checkbox
            id={rowId(row.key)}
            checked={row.allowed}
            disabled={row.locked}
            onchange={(event) => onchange(row.key, event.currentTarget.checked)}
          >
            {row.label}
          </Checkbox>
          {#if row.locked && onOverride}
            <Button variant="ghost" size="sm" onclick={() => onOverride(row.key)}>
              {overrideLabel}
            </Button>
          {/if}
        </div>
        <p class="sanvi-preferences__description">{row.description}</p>
        <p class="sanvi-preferences__detail">{row.consequence}</p>
        {#if row.vendors}
          <p class="sanvi-preferences__detail">{row.vendors}</p>
        {/if}
        {#if row.source}
          <p class="sanvi-preferences__source">{row.source}</p>
        {/if}
        {#if row.locked && row.lockedNote}
          <p class="sanvi-preferences__locked" role="status">{row.lockedNote}</p>
        {/if}
      </li>
    {/each}
  </ul>

  {#if sensitiveRows.length > 0 && sensitiveTitle}
    <h3 class="sanvi-preferences__sensitive-title">{sensitiveTitle}</h3>
    <ul class="sanvi-preferences__list">
      {#each sensitiveRows as row (row.key)}
        <li class="sanvi-preferences__row">
          <div class="sanvi-preferences__control">
            <Checkbox
              id={rowId(row.key)}
              checked={row.allowed}
              disabled={row.locked}
              onchange={(event) => onchange(row.key, event.currentTarget.checked)}
            >
              {row.label}
            </Checkbox>
            {#if row.locked && onOverride}
              <Button variant="ghost" size="sm" onclick={() => onOverride(row.key)}>
                {overrideLabel}
              </Button>
            {/if}
          </div>
          <p class="sanvi-preferences__description">{row.description}</p>
          <p class="sanvi-preferences__detail">{row.consequence}</p>
          {#if row.source}
            <p class="sanvi-preferences__source">{row.source}</p>
          {/if}
          {#if row.locked && row.lockedNote}
            <p class="sanvi-preferences__locked" role="status">{row.lockedNote}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sanvi-preferences__gpc {
    margin: 0 0 var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-preferences__list {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    margin: 0 0 var(--sanvi-spacing-4);
    padding: 0;
    list-style: none;
  }

  .sanvi-preferences__row {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    padding-bottom: var(--sanvi-spacing-4);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-preferences__control {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-preferences__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-preferences__detail {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-preferences__source {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-preferences__locked {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-status-warning);
  }

  .sanvi-preferences__sensitive-title {
    margin: 0 0 var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
  }
</style>
