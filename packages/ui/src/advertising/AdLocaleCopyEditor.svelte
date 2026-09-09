<script lang="ts">
import { untrack } from 'svelte'
import Field from '../Field.svelte'
import Textarea from '../Textarea.svelte'
import { codePointLength } from '../forms/schema'
import type { CampaignFormTextEntry } from '../forms/types'

/**
 * Per-locale creative copy fields (phase 10, TASK-013) — the engine's
 * `texts` group as a standalone editor for surfaces that manage copy
 * outside the campaign builder. Field availability and limits come from the
 * caller's matrix-derived `limitsByLocale` (what `textFieldsFor` resolves
 * per locale); a locale the matrix has no entry for renders no fields, and
 * a counter shows the limit that locale actually carries — the same copy
 * can pass in one locale and fail in another where the limit is shorter.
 *
 * The component stays i18n-free: locale and field names arrive through
 * `optionLabels`, counter and error wording through the `format*`
 * callbacks, with English defaults keeping Storybook honest.
 */
interface Props {
  /**
   * Bindable entries, one per content locale. Absent on first render, the
   * component seeds one entry per locale in `limitsByLocale`'s key order
   * and owns them (the same pattern as the engine's draft seeding); a
   * parent that binds can autosave or read the entries back at submit.
   */
  entries?: CampaignFormTextEntry[]
  /** Locale → field name → inclusive character limit (matrix data). */
  limitsByLocale: Record<string, Record<string, number>>
  /** Localized labels keyed by the raw locale and field-name values. */
  optionLabels?: Record<string, string>
  /** `"{current} / {limit}"`-style counter shown while a field carries a limit. */
  formatCounter?: (current: number, limit: number) => string
  /** Over-the-limit error, shown live — not only after a submit attempt. */
  formatTooLongError?: (limit: number, current: number) => string
  disabled?: boolean
  class?: string
}

let {
  entries = $bindable<CampaignFormTextEntry[] | undefined>(undefined),
  limitsByLocale,
  optionLabels = {},
  formatCounter = (current, limit) => `${current} / ${limit}`,
  formatTooLongError = (limit, current) =>
    `Must be ${limit} characters or fewer (currently ${current}).`,
  disabled = false,
  class: className = '',
}: Props = $props()

/**
 * The locales and fields the current limits define, as a comparable string.
 * The parent rebuilds `limitsByLocale` as a fresh object on every recompute,
 * so object identity says nothing about whether the matrix actually changed
 * — only its contents do.
 */
function limitsSignature(limits: Record<string, Record<string, number>>): string {
  return Object.entries(limits)
    .map(([locale, fields]) => `${locale}:${Object.keys(fields).join(',')}`)
    .join('|')
}

// First render: seed only when unbound, so a parent can pass restored
// entries (the autosave-resume path). After that, a change to the limits
// *contents* means the matrix changed under us — stale entries would bind
// values to fields that no longer exist, so they are discarded wholesale.
// `entries` is deliberately not read reactively: a parent assigning restored
// entries after first render must not look like a matrix change and wipe
// the very copy it just restored.
let seededSignature: string | undefined
$effect.pre(() => {
  const signature = limitsSignature(limitsByLocale)
  if (signature === seededSignature) return
  const first = seededSignature === undefined
  seededSignature = signature
  if (first && untrack(() => entries) !== undefined) return
  entries = Object.keys(limitsByLocale).map((locale) => ({ locale, values: {} }))
})

const visible = $derived(entries ?? [])

function label(value: string): string {
  return optionLabels[value] ?? value
}

function valueFor(entry: CampaignFormTextEntry | undefined, field: string): string {
  return entry?.values[field] ?? ''
}

function setValue(entry: CampaignFormTextEntry | undefined, field: string, value: string): void {
  if (entry) entry.values[field] = value
}

function overLimit(
  entry: CampaignFormTextEntry | undefined,
  field: string,
  limit: number,
): boolean {
  return codePointLength(valueFor(entry, field)) > limit
}
</script>

<div class="sanvi-ad-copy {className}">
  {#each visible as entry (entry.locale)}
    {@const limits = limitsByLocale[entry.locale]}
    {#if limits && Object.keys(limits).length > 0}
      <fieldset class="sanvi-ad-copy__locale" lang={entry.locale}>
        <legend class="sanvi-ad-copy__legend">{label(entry.locale)}</legend>
        {#each Object.entries(limits) as [field, limit] (field)}
          {@const current = codePointLength(valueFor(entry, field))}
          <Field
            label={label(field)}
            hint={formatCounter(current, limit)}
            error={overLimit(entry, field, limit) ? formatTooLongError(limit, current) : undefined}
          >
            {#snippet children(control)}
              <Textarea
                id={control.id}
                rows={2}
                disabled={disabled}
                value={valueFor(entry, field)}
                oninput={(event) => {
                  setValue(entry, field, event.currentTarget.value)
                }}
                invalid={control.invalid}
                describedBy={control.describedBy}
              />
            {/snippet}
          </Field>
        {/each}
      </fieldset>
    {/if}
  {/each}
</div>

<style>
  .sanvi-ad-copy {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-ad-copy__locale {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: 0;
    border: none;
    margin: 0;
  }

  .sanvi-ad-copy__legend {
    padding: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }
</style>
