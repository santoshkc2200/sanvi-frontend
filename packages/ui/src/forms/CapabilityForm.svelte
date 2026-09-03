<script lang="ts">
import Button from '../Button.svelte'
import Checkbox from '../Checkbox.svelte'
import Field from '../Field.svelte'
import Input from '../Input.svelte'
import Select from '../Select.svelte'
import Textarea from '../Textarea.svelte'
import {
  campaignFormSchema,
  codePointLength,
  emptyDraft,
  FIELD_PATHS,
  schemaCacheKey,
  textFieldsFor,
} from './schema'
import { humanizeOptionValue } from './humanize'
import { mapViolations, validateDraft } from './validate'
import type { AdCapabilityMatrix, CampaignFormDraft, FormIssue, ServerViolation } from './types'

/**
 * The capability-driven campaign form engine (phase 10, TASK-010).
 *
 * Every field, option, limit, and minimum renders from the
 * backend-provided capability matrix — the matrix is the only source. A
 * value the platform cannot express (an objective outside its list, a text
 * field with no limit for a locale) is *absent from the DOM*, never
 * disabled-and-broken, and a value this component has never seen (a new
 * objective arriving in a matrix update) renders as humanized data with no
 * frontend change.
 *
 * The component stays i18n-free: static labels come in through `labels`
 * (English defaults keep Storybook honest), parameterized ones through the
 * `format*` callbacks, and option values through `optionLabels` keyed by
 * the matrix value itself.
 */
interface Labels {
  nameLabel?: string
  objectiveLabel?: string
  objectivePlaceholder?: string
  budgetKindLabel?: string
  budgetKindPlaceholder?: string
  budgetAmountLabel?: string
  targetingLabel?: string
  textsLabel?: string
  textLocaleLabel?: string
  requiredError?: string
  integerError?: string
  unavailableOptionError?: string
  formSubmitError?: string
  submitLabel?: string
  localeErrorSuffix?: string
}

interface Props {
  matrix: AdCapabilityMatrix
  /** Disambiguates the schema memoization when several platforms render. */
  cacheKey?: string
  /**
   * The ad account's currency, for the matrix's minimum-budget lookup.
   * Shown natively, never converted; without it the client-side minimum
   * check is skipped (the backend still enforces it).
   */
  currency?: string
  labels?: Labels
  /** Localized labels for matrix values (objectives, kinds, fields, locales). */
  optionLabels?: Record<string, string>
  /** Violations from a failed submission, mapped onto fields by path. */
  serverViolations?: ServerViolation[]
  /** `"{current} / {limit}"`-style counter for a limited text field. */
  formatCounter?: (current: number, limit: number) => string
  /** Hint stating the budget minimum, in the ad account's currency terms. */
  formatMinimumHint?: (minimumMinor: number) => string
  /** Error for a budget below the matrix minimum. */
  formatBelowMinimumError?: (minimumMinor: number) => string
  /** Error for text over a locale's limit. */
  formatTooLongError?: (limit: number, current: number) => string
  /** Formats an issue message from a non-active locale's text entry. */
  formatNonActiveLocaleMessage?: (locale: string, message: string) => string
  onSubmit?: (draft: CampaignFormDraft) => void
  class?: string
}

let {
  matrix,
  cacheKey,
  currency,
  labels = {},
  optionLabels = {},
  serverViolations = [],
  formatCounter = (current, limit) => `${current} / ${limit}`,
  formatMinimumHint = (minimum) => `Minimum: ${minimum}`,
  formatBelowMinimumError = (minimum) => `Must be at least ${minimum} minor units.`,
  formatTooLongError = (limit, current) =>
    `Must be ${limit} characters or fewer (currently ${current}).`,
  formatNonActiveLocaleMessage = (locale, message) => `[${locale}] ${message}`,
  onSubmit,
  class: className = '',
}: Props = $props()

const COPY = {
  nameLabel: 'Campaign name',
  objectiveLabel: 'Objective',
  objectivePlaceholder: 'Choose an objective',
  budgetKindLabel: 'Budget type',
  budgetKindPlaceholder: 'Choose a budget type',
  budgetAmountLabel: 'Budget amount (minor units)',
  targetingLabel: 'Targeting',
  textsLabel: 'Ad text',
  textLocaleLabel: 'Text language',
  requiredError: 'This field is required.',
  integerError: 'Enter a whole number of minor units.',
  unavailableOptionError: 'This option is not available for this platform.',
  formSubmitError: 'Some issues could not be matched to a field:',
  submitLabel: 'Save',
  localeErrorSuffix: ' (has errors)',
}

const display = $derived({
  nameLabel: labels.nameLabel ?? COPY.nameLabel,
  objectiveLabel: labels.objectiveLabel ?? COPY.objectiveLabel,
  objectivePlaceholder: labels.objectivePlaceholder ?? COPY.objectivePlaceholder,
  budgetKindLabel: labels.budgetKindLabel ?? COPY.budgetKindLabel,
  budgetKindPlaceholder: labels.budgetKindPlaceholder ?? COPY.budgetKindPlaceholder,
  budgetAmountLabel: labels.budgetAmountLabel ?? COPY.budgetAmountLabel,
  targetingLabel: labels.targetingLabel ?? COPY.targetingLabel,
  textsLabel: labels.textsLabel ?? COPY.textsLabel,
  textLocaleLabel: labels.textLocaleLabel ?? COPY.textLocaleLabel,
  requiredError: labels.requiredError ?? COPY.requiredError,
  integerError: labels.integerError ?? COPY.integerError,
  unavailableOptionError: labels.unavailableOptionError ?? COPY.unavailableOptionError,
  formSubmitError: labels.formSubmitError ?? COPY.formSubmitError,
  submitLabel: labels.submitLabel ?? COPY.submitLabel,
  localeErrorSuffix: labels.localeErrorSuffix ?? COPY.localeErrorSuffix,
})

const schema = $derived(campaignFormSchema(matrix, cacheKey))

const schemaKey = $derived(schemaCacheKey(matrix, cacheKey))
// Deliberate initial capture: the $effect.pre below replaces the draft
// whenever the matrix (or its version) changes afterwards.
// svelte-ignore state_referenced_locally
let draft = $state<CampaignFormDraft>(emptyDraft(schema))
let activeLocale = $state('')
let clientIssues = $state<FormIssue[]>([])
// The memoized schema is identity-stable per matrix version, so this fires
// exactly when the platform (or its matrix version) changes — the draft
// resets rather than carrying fields between platforms.
$effect.pre(() => {
  void schemaKey
  draft = emptyDraft(schema)
  activeLocale = schema.texts.locales[0] ?? ''
  clientIssues = []
})

const activeTextFields = $derived(
  activeLocale === '' ? {} : textFieldsFor(schema.texts, activeLocale),
)

const mappedServer = $derived(mapViolations(schema, draft, serverViolations))

function issueMessages(path: string): string[] {
  return [
    ...clientIssues.filter((issue) => issue.path === path).map((issue) => clientMessage(issue)),
    ...(mappedServer.fieldMessages[path] ?? []),
  ]
}

function localeHasErrors(locale: string): boolean {
  const index = draft.texts.findIndex((entry) => entry.locale === locale)
  if (index === -1) return false
  const fields = Object.keys(textFieldsFor(schema.texts, locale))
  return fields.some((field) => issueMessages(FIELD_PATHS.textEntry(index, field)).length > 0)
}

const nonActiveLocaleMessages = $derived.by(() => {
  const result: string[] = []
  draft.texts.forEach((entry, index) => {
    if (entry.locale === activeLocale) return
    const fields = Object.keys(textFieldsFor(schema.texts, entry.locale))
    for (const field of fields) {
      const path = FIELD_PATHS.textEntry(index, field)
      for (const msg of issueMessages(path)) {
        result.push(formatNonActiveLocaleMessage(entry.locale, msg))
      }
    }
  })
  return result
})

const formLevelMessages = $derived([...mappedServer.formMessages, ...nonActiveLocaleMessages])

const targetingMessages = $derived([
  ...issueMessages(FIELD_PATHS.targeting),
  ...draft.targeting.flatMap((dimension) => issueMessages(`${FIELD_PATHS.targeting}.${dimension}`)),
])

function clientMessage(issue: FormIssue): string {
  switch (issue.code) {
    case 'required':
      return display.requiredError
    case 'integer':
      return display.integerError
    case 'unavailableOption':
      return display.unavailableOptionError
    case 'belowMinimum':
      return formatBelowMinimumError(issue.minimum ?? 0)
    case 'tooLong':
      return formatTooLongError(issue.limit ?? 0, issue.current ?? 0)
  }
}

function optionLabel(value: string): string {
  return optionLabels[value] ?? humanizeOptionValue(value)
}

function textValue(index: number, field: string): string {
  return draft.texts[index]?.values[field] ?? ''
}

function setTextValue(index: number, field: string, value: string): void {
  const entry = draft.texts[index]
  if (entry) entry.values[field] = value
}

function toggleTargeting(dimension: string, checked: boolean): void {
  draft.targeting = checked
    ? [...draft.targeting, dimension]
    : draft.targeting.filter((existing) => existing !== dimension)
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault()
  const issues = validateDraft(schema, draft, currency)
  clientIssues = issues
  if (issues.length === 0) onSubmit?.(draft)
}

function budgetMinimum(): number | undefined {
  if (!currency || draft.budgetKind === '') return undefined
  return schema.minimumBudgets[currency]?.[draft.budgetKind]
}
</script>

<form class="sanvi-capability-form {className}" onsubmit={handleSubmit}>
  {#if formLevelMessages.length > 0}
    <div class="sanvi-capability-form__form-level" role="alert">
      <p>{display.formSubmitError}</p>
      <ul>
        {#each formLevelMessages as message, index (`${index}-${message}`)}
          <li>{message}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <Field
    label={display.nameLabel}
    required
    error={issueMessages(FIELD_PATHS.name).join(' ') || undefined}
  >
    {#snippet children(control)}
      <Input
        id={control.id}
        value={draft.name}
        oninput={(event) => {
          draft.name = event.currentTarget.value
        }}
        invalid={control.invalid}
        describedBy={control.describedBy}
      />
    {/snippet}
  </Field>

  <Field
    label={display.objectiveLabel}
    required
    error={issueMessages(FIELD_PATHS.objective).join(' ') || undefined}
  >
    {#snippet children(control)}
      <Select
        id={control.id}
        value={draft.objective}
        options={schema.objectiveOptions.map((value) => ({
          value,
          label: optionLabel(value),
        }))}
        placeholder={display.objectivePlaceholder}
        onchange={(event) => {
          draft.objective = event.currentTarget.value
        }}
        invalid={control.invalid}
        describedBy={control.describedBy}
      />
    {/snippet}
  </Field>

  <Field
    label={display.budgetKindLabel}
    required
    error={issueMessages(FIELD_PATHS.budgetKind).join(' ') || undefined}
  >
    {#snippet children(control)}
      <Select
        id={control.id}
        value={draft.budgetKind}
        options={schema.budgetKinds.map((value) => ({
          value,
          label: optionLabel(value),
        }))}
        placeholder={display.budgetKindPlaceholder}
        onchange={(event) => {
          draft.budgetKind = event.currentTarget.value
        }}
        invalid={control.invalid}
        describedBy={control.describedBy}
      />
    {/snippet}
  </Field>

  <Field
    label={display.budgetAmountLabel}
    required
    hint={(() => {
      const minimum = budgetMinimum()
      return minimum === undefined ? undefined : formatMinimumHint(minimum)
    })()}
    error={issueMessages(FIELD_PATHS.budgetAmount).join(' ') || undefined}
  >
    {#snippet children(control)}
      <Input
        id={control.id}
        value={draft.budgetAmountMinor}
        inputmode="numeric"
        oninput={(event) => {
          draft.budgetAmountMinor = event.currentTarget.value
        }}
        invalid={control.invalid}
        describedBy={control.describedBy}
      />
    {/snippet}
  </Field>

  {#if schema.targetingOptions.length > 0}
    <fieldset
      class="sanvi-capability-form__group"
      aria-describedby={
        targetingMessages.length > 0 ? 'sanvi-capability-form--targeting-error' : undefined
      }
    >
      <legend class="sanvi-capability-form__legend">{display.targetingLabel}</legend>
      <div class="sanvi-capability-form__checkboxes">
        {#each schema.targetingOptions as dimension (dimension)}
          <Checkbox
            checked={draft.targeting.includes(dimension)}
            onchange={(event) => {
              toggleTargeting(dimension, event.currentTarget.checked)
            }}
          >
            {optionLabel(dimension)}
          </Checkbox>
        {/each}
      </div>
      {#if targetingMessages.length > 0}
        <p
          id="sanvi-capability-form--targeting-error"
          class="sanvi-capability-form__group-error"
          role="alert"
        >
          {targetingMessages.join(' ')}
        </p>
      {/if}
    </fieldset>
  {/if}

  {#if schema.texts.locales.length > 0}
    <fieldset class="sanvi-capability-form__group">
      <legend class="sanvi-capability-form__legend">{display.textsLabel}</legend>
      <Field label={display.textLocaleLabel}>
        {#snippet children(control)}
          <Select
            id={control.id}
            value={activeLocale}
            options={schema.texts.locales.map((value) => {
              const baseLabel = optionLabels[value] ?? value
              return {
                value,
                label: localeHasErrors(value)
                  ? `${baseLabel}${display.localeErrorSuffix}`
                  : baseLabel,
              }
            })}
            onchange={(event) => {
              activeLocale = event.currentTarget.value
            }}
            describedBy={control.describedBy}
          />
        {/snippet}
      </Field>
      {#each Object.entries(activeTextFields) as [field, limit] (field)}
        {@const entryIndex = draft.texts.findIndex((entry) => entry.locale === activeLocale)}
        {@const path = FIELD_PATHS.textEntry(entryIndex, field)}
        <Field
          label={optionLabel(field)}
          hint={formatCounter(codePointLength(textValue(entryIndex, field)), limit)}
          error={issueMessages(path).join(' ') || undefined}
        >
          {#snippet children(control)}
            <Textarea
              id={control.id}
              rows={2}
              value={textValue(entryIndex, field)}
              oninput={(event) => {
                setTextValue(entryIndex, field, event.currentTarget.value)
              }}
              invalid={control.invalid}
              describedBy={control.describedBy}
            />
          {/snippet}
        </Field>
      {/each}
    </fieldset>
  {/if}

  <div class="sanvi-capability-form__actions">
    <Button type="submit" variant="primary">{display.submitLabel}</Button>
  </div>
</form>

<style>
  .sanvi-capability-form {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-5);
  }

  .sanvi-capability-form__form-level {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-error);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-capability-form__form-level p {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-capability-form__form-level ul {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-status-error);
  }

  .sanvi-capability-form__group {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: 0;
    border: none;
    margin: 0;
  }

  .sanvi-capability-form__legend {
    padding: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-capability-form__checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
  }

  .sanvi-capability-form__group-error {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-status-error);
  }

  .sanvi-capability-form__actions {
    display: flex;
    justify-content: flex-start;
  }
</style>
