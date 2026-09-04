<script lang="ts">
import { untrack } from 'svelte'
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
  /**
   * Bindable draft. The component owns its draft by default (created empty,
   * reset when the matrix changes); a parent that binds it can autosave,
   * resume, or drive the same fields from a stepper (TASK-012's builder).
   * Assigning a bound draft replaces the fields wholesale; matrix changes
   * still reset it.
   */
  draft?: CampaignFormDraft
  /**
   * Which field groups render, by group id (`basics`, `budget`, `targeting`,
   * `texts`). Undefined renders every group the matrix offers — the
   * single-page form. A stepper passes one group per step; a group the
   * matrix has no data for stays absent regardless.
   */
  visibleGroups?: string[]
  /**
   * What the submit validates: `'all'` (the default — the whole draft, so
   * the single-page form blocks on everything) or `'visible'` (only the
   * rendered groups — how the stepper validates one step at a time; the
   * review step then re-validates `'all'` before submit).
   */
  validateScope?: 'all' | 'visible'
  /**
   * Force the submit button to render even in stepper mode (one group per
   * step). The stepper's own Continue lives *inside* the form, so a blocked
   * advance shows the field errors instead of doing nothing.
   */
  submitVisible?: boolean
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
  onSubmit?: (draft: CampaignFormDraft) => void
  class?: string
}

let {
  matrix,
  cacheKey,
  currency,
  draft = $bindable<CampaignFormDraft | undefined>(undefined),
  visibleGroups = undefined,
  validateScope = 'all',
  submitVisible = false,
  labels = {},
  optionLabels = {},
  serverViolations = [],
  formatCounter = (current, limit) => `${current} / ${limit}`,
  formatMinimumHint = (minimum) => `Minimum: ${minimum}`,
  formatBelowMinimumError = (minimum) => `Must be at least ${minimum} minor units.`,
  formatTooLongError = (limit, current) =>
    `Must be ${limit} characters or fewer (currently ${current}).`,
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
})

const schema = $derived(campaignFormSchema(matrix, cacheKey))

const schemaKey = $derived(schemaCacheKey(matrix, cacheKey))
// The $effect.pre below seeds an absent draft (the unbound single-page
// form) and replaces the draft whenever the matrix (or its version) changes
// afterwards. A bound draft is left alone on the first run — that is the
// autosave resume path (TASK-012's builder) — and only a matrix change
// resets it. The draft read is untracked so writing it never retriggers
// this effect; its only dependency is the schema key.
let activeLocale = $state('')
let schemaObserved = false
$effect.pre(() => {
  void schemaKey
  const shouldSeed = untrack(() => draft === undefined)
  if (shouldSeed || schemaObserved) {
    draft = emptyDraft(schema)
    activeLocale = schema.texts.locales[0] ?? ''
  }
  schemaObserved = true
})

// Non-undefined view of the draft for the template and validators. Before
// the first render the seeding effect has already put a real draft in place,
// so the fallback here exists for the type system, not the runtime.
const form = $derived(draft ?? emptyDraft(schema))

function shows(group: string): boolean {
  return visibleGroups === undefined || visibleGroups.includes(group)
}

/** The field paths the rendered groups own — the `'visible'` validation scope. */
function visibleIssuePaths(): Set<string> {
  const paths = new Set<string>()
  if (shows('basics')) {
    paths.add(FIELD_PATHS.name)
    paths.add(FIELD_PATHS.objective)
  }
  if (shows('budget')) {
    paths.add(FIELD_PATHS.budgetKind)
    paths.add(FIELD_PATHS.budgetAmount)
  }
  if (shows('targeting')) {
    for (const dimension of schema.targetingOptions) {
      paths.add(`${FIELD_PATHS.targeting}.${dimension}`)
    }
  }
  return paths
}

let clientIssues = $state<FormIssue[]>([])

const activeTextFields = $derived(
  activeLocale === '' ? {} : textFieldsFor(schema.texts, activeLocale),
)

const mappedServer = $derived(mapViolations(schema, form, serverViolations))
const formLevelMessages = $derived(mappedServer.formMessages)

function issueMessages(path: string): string[] {
  return [
    ...clientIssues.filter((issue) => issue.path === path).map((issue) => clientMessage(issue)),
    ...(mappedServer.fieldMessages[path] ?? []),
  ]
}

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
  return form.texts[index]?.values[field] ?? ''
}

function setTextValue(index: number, field: string, value: string): void {
  const entry = form.texts[index]
  if (entry) entry.values[field] = value
}

function toggleTargeting(dimension: string, checked: boolean): void {
  form.targeting = checked
    ? [...form.targeting, dimension]
    : form.targeting.filter((existing) => existing !== dimension)
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault()
  let issues = validateDraft(schema, form, currency)
  if (validateScope === 'visible') {
    const owned = visibleIssuePaths()
    issues = issues.filter((issue) => owned.has(issue.path))
  }
  clientIssues = issues
  if (issues.length === 0) onSubmit?.(form)
}

function budgetMinimum(): number | undefined {
  if (!currency || form.budgetKind === '') return undefined
  return schema.minimumBudgets[currency]?.[form.budgetKind]
}
</script>

<form class="sanvi-capability-form {className}" onsubmit={handleSubmit}>
  {#if formLevelMessages.length > 0}
    <div class="sanvi-capability-form__form-level" role="alert">
      <p>{display.formSubmitError}</p>
      <ul>
        {#each formLevelMessages as message (message)}
          <li>{message}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if shows('basics')}
    <Field
      label={display.nameLabel}
      required
      error={issueMessages(FIELD_PATHS.name).join(' ') || undefined}
    >
      {#snippet children(control)}
        <Input
          id={control.id}
          value={form.name}
          oninput={(event) => {
            form.name = event.currentTarget.value
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
          value={form.objective}
          options={schema.objectiveOptions.map((value) => ({
            value,
            label: optionLabel(value),
          }))}
          placeholder={display.objectivePlaceholder}
          onchange={(event) => {
            form.objective = event.currentTarget.value
          }}
          invalid={control.invalid}
          describedBy={control.describedBy}
        />
      {/snippet}
    </Field>
  {/if}

  {#if shows('budget')}
    <Field
      label={display.budgetKindLabel}
      required
      error={issueMessages(FIELD_PATHS.budgetKind).join(' ') || undefined}
    >
    {#snippet children(control)}
      <Select
        id={control.id}
        value={form.budgetKind}
        options={schema.budgetKinds.map((value) => ({
          value,
          label: optionLabel(value),
        }))}
        placeholder={display.budgetKindPlaceholder}
        onchange={(event) => {
          form.budgetKind = event.currentTarget.value
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
        value={form.budgetAmountMinor}
        inputmode="numeric"
        oninput={(event) => {
          form.budgetAmountMinor = event.currentTarget.value
        }}
        invalid={control.invalid}
        describedBy={control.describedBy}
      />
    {/snippet}
  </Field>
  {/if}

  {#if shows('targeting')}
  {#if schema.targetingOptions.length > 0}
    <fieldset
      class="sanvi-capability-form__group"
      aria-describedby={
        issueMessages(FIELD_PATHS.targeting).length > 0 ? 'sanvi-capability-form--targeting-error' : undefined
      }
    >
      <legend class="sanvi-capability-form__legend">{display.targetingLabel}</legend>
      <div class="sanvi-capability-form__checkboxes">
        {#each schema.targetingOptions as dimension (dimension)}
          <Checkbox
            checked={form.targeting.includes(dimension)}
            onchange={(event) => {
              toggleTargeting(dimension, event.currentTarget.checked)
            }}
          >
            {optionLabel(dimension)}
          </Checkbox>
        {/each}
      </div>
      {#if issueMessages(FIELD_PATHS.targeting).length > 0}
        <p
          id="sanvi-capability-form--targeting-error"
          class="sanvi-capability-form__group-error"
          role="alert"
        >
          {issueMessages(FIELD_PATHS.targeting).join(' ')}
        </p>
      {/if}
    </fieldset>
  {/if}
  {/if}

  {#if shows('texts') && schema.texts.locales.length > 0}
    <fieldset class="sanvi-capability-form__group">
      <legend class="sanvi-capability-form__legend">{display.textsLabel}</legend>
      <Field label={display.textLocaleLabel}>
        {#snippet children(control)}
          <Select
            id={control.id}
            value={activeLocale}
            options={schema.texts.locales.map((value) => ({
              value,
              label: optionLabels[value] ?? value,
            }))}
            onchange={(event) => {
              activeLocale = event.currentTarget.value
            }}
            describedBy={control.describedBy}
          />
        {/snippet}
      </Field>
      {#each Object.entries(activeTextFields) as [field, limit] (field)}
        {@const entryIndex = form.texts.findIndex((entry) => entry.locale === activeLocale)}
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

  {#if visibleGroups === undefined || submitVisible}
    <div class="sanvi-capability-form__actions">
      <Button type="submit" variant="primary">{display.submitLabel}</Button>
    </div>
  {/if}
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
