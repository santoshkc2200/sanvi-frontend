import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import CapabilityForm from '../src/forms/CapabilityForm.svelte'
import {
  campaignFormSchema,
  codePointLength,
  emptyDraft,
  FIELD_PATHS,
  schemaCacheKey,
  textFieldsFor,
  textLimit,
} from '../src/forms/schema'
import type { AdCapabilityMatrix } from '../src/forms/types'
import { mapViolations, validateDraft } from '../src/forms/validate'
import { AD_PLATFORM_FIXTURES, fixturePlatformByKey } from './fixtures/advertising/index'

const GOOGLE = fixturePlatformByKey('google_ads')!.capability_matrix
const META = fixturePlatformByKey('meta')!.capability_matrix
const ASYMMETRIC = fixturePlatformByKey('asymmetric_demo')!.capability_matrix

describe('campaignFormSchema (matrix → fields)', () => {
  it('derives options, limits, and minimums from matrix data alone', () => {
    const schema = campaignFormSchema(GOOGLE)
    expect(schema.objectiveOptions).toEqual(GOOGLE.objectives)
    expect(schema.budgetKinds).toEqual(GOOGLE.budget_types)
    expect(schema.targetingOptions).toEqual(GOOGLE.targeting_dimensions)
    expect(schema.minimumBudgets).toEqual(GOOGLE.minimum_budgets_minor)
    expect(textFieldsFor(schema.texts, 'en')).toEqual(GOOGLE.text_limits.en)
    expect(textFieldsFor(schema.texts, 'ja')).toEqual(GOOGLE.text_limits.ja)
  })

  it('is memoized per matrix version + content, so refetches of an unchanged matrix reuse it', () => {
    const first = campaignFormSchema(GOOGLE)
    expect(campaignFormSchema(GOOGLE)).toBe(first)
    // Same version string, different content → separate entry.
    const edited = { ...GOOGLE, objectives: [...GOOGLE.objectives] }
    edited.objectives[0] = `${GOOGLE.objectives[0]}_x`
    expect(campaignFormSchema(edited)).not.toBe(first)
    expect(campaignFormSchema(edited)).toBe(campaignFormSchema(edited))
  })

  it('differentiates matrices that differ only in deeply nested values', () => {
    const base = GOOGLE
    const firstLocale = Object.keys(base.text_limits)[0]!
    const firstField = Object.keys(base.text_limits[firstLocale]!)[0]!
    const currentLimit = base.text_limits[firstLocale]![firstField]!
    const variant: AdCapabilityMatrix = {
      ...base,
      text_limits: {
        ...base.text_limits,
        [firstLocale]: {
          ...base.text_limits[firstLocale]!,
          [firstField]: currentLimit + 10,
        },
      },
    }
    expect(schemaCacheKey(base)).not.toBe(schemaCacheKey(variant))
    expect(campaignFormSchema(base)).not.toBe(campaignFormSchema(variant))
  })

  it('resolves the default limits entry for locales with no explicit entry, and not for ones with', () => {
    const withDefault = {
      ...GOOGLE,
      text_limits: {
        ...GOOGLE.text_limits,
        default: { headline: 10, body: 20 },
        // A locale whose entry omits a field the default has: the explicit
        // entry wins wholesale, mirroring the backend's text_limit().
        ja: { headline: 30 },
      },
    }
    const schema = campaignFormSchema(withDefault, 'default-test')
    expect(textFieldsFor(schema.texts, 'ja')).toEqual({ headline: 30 })
    expect(textFieldsFor(schema.texts, 'fr')).toEqual({ headline: 10, body: 20 })
    expect(schema.texts.locales).toEqual(['en', 'ja'])
  })

  it('counts code points, not UTF-16 units', () => {
    expect(codePointLength('キャンペーン')).toBe(6)
  })
})

describe('validateDraft (client-side, from the same matrix the backend enforces)', () => {
  const schema = campaignFormSchema(GOOGLE, 'validate-google')

  function validDraft(): ReturnType<typeof emptyDraft> {
    const draft = emptyDraft(schema)
    draft.name = 'Summer sale'
    draft.objective = GOOGLE.objectives[0]!
    draft.budgetKind = 'daily'
    draft.budgetAmountMinor = '100'
    draft.texts[0]!.values = { headline: 'Big savings', body: 'Shop now' }
    return draft
  }

  it('accepts a valid draft', () => {
    expect(validateDraft(schema, validDraft(), 'JPY')).toEqual([])
  })

  it('requires name, objective, and budget fields', () => {
    const issues = validateDraft(schema, emptyDraft(schema), 'JPY')
    expect(issues.map((issue) => issue.path)).toEqual([
      FIELD_PATHS.name,
      FIELD_PATHS.objective,
      FIELD_PATHS.budgetKind,
      FIELD_PATHS.budgetAmount,
    ])
    expect(issues.every((issue) => issue.code === 'required')).toBe(true)
  })

  it('rejects a budget below the matrix minimum for the ad account currency', () => {
    const draft = validDraft()
    draft.budgetAmountMinor = '50'
    expect(validateDraft(schema, draft, 'JPY')).toEqual([
      { code: 'belowMinimum', minimum: 100, path: FIELD_PATHS.budgetAmount },
    ])
    // The minimum is only knowable with the ad account's currency.
    expect(validateDraft(schema, draft)).toEqual([])
  })

  it('rejects non-integer minor-unit amounts', () => {
    const draft = validDraft()
    draft.budgetAmountMinor = '12.5'
    expect(validateDraft(schema, draft, 'JPY').map((issue) => issue.code)).toEqual(['integer'])
  })

  it('applies the per-locale limit: a Japanese string that passes the English limit fails the Japanese one', () => {
    const metaSchema = campaignFormSchema(META, 'validate-meta')
    const draft = emptyDraft(metaSchema)
    draft.name = 'Summer'
    draft.objective = META.objectives[0]!
    draft.budgetKind = 'daily'
    draft.budgetAmountMinor = '100'

    const headline35 = 'x'.repeat(35)
    const enDraft = {
      ...draft,
      texts: [{ locale: 'en', values: { headline: headline35, body: '' } }],
    }
    expect(validateDraft(metaSchema, enDraft)).toEqual([])

    const jaDraft = {
      ...draft,
      texts: [{ locale: 'ja', values: { headline: headline35, body: '' } }],
    }
    expect(validateDraft(metaSchema, jaDraft)).toEqual([
      { code: 'tooLong', current: 35, limit: 25, path: 'texts[0].headline' },
    ])
    expect(textLimit(metaSchema.texts, 'ja', 'headline')).toBe(25)
  })

  it('enforces the same content differently per platform from matrix data alone', () => {
    // 20 characters passes Google's English headline limit (30) but fails the
    // asymmetric network's (18) — same content, matrices differ.
    const headline = 'x'.repeat(20)
    const googleSchema = campaignFormSchema(GOOGLE, 'validate-google-2')
    const googleDraft = emptyDraft(googleSchema)
    googleDraft.name = 'Summer'
    googleDraft.objective = GOOGLE.objectives[0]!
    googleDraft.budgetKind = 'daily'
    googleDraft.budgetAmountMinor = '100'
    googleDraft.texts[0]!.values = { headline, body: '' }
    expect(validateDraft(googleSchema, googleDraft)).toEqual([])

    const asymmetricSchema = campaignFormSchema(ASYMMETRIC, 'validate-asymmetric')
    const asymmetricDraft = emptyDraft(asymmetricSchema)
    asymmetricDraft.name = 'Summer'
    asymmetricDraft.objective = ASYMMETRIC.objectives[0]!
    asymmetricDraft.budgetKind = ASYMMETRIC.budget_types[0]!
    asymmetricDraft.budgetAmountMinor = '100'
    asymmetricDraft.texts[0]!.values = { headline, body: '' }
    expect(validateDraft(asymmetricSchema, asymmetricDraft)).toEqual([
      { code: 'tooLong', current: 20, limit: 18, path: 'texts[0].headline' },
    ])
  })

  it('attributes text limit issues using array index directly even when entries share object references', () => {
    const draft = validDraft()
    const sharedEntry = { locale: 'ja', values: { headline: 'x'.repeat(35), body: '' } }
    draft.texts = [sharedEntry, sharedEntry]
    const issues = validateDraft(schema, draft)
    expect(issues.map((i) => i.path)).toContain('texts[1].headline')
  })
})

describe('mapViolations (server violations land on fields by path)', () => {
  const schema = campaignFormSchema(GOOGLE, 'map-google')
  const draft = emptyDraft(schema)

  it('maps a field-path violation onto that field', () => {
    const mapped = mapViolations(schema, draft, [
      {
        code: 'invalid',
        field_path: 'budget.amount.amount_minor',
        message: 'budget is below the 100 minor-unit minimum',
      },
    ])
    expect(mapped.fieldMessages).toEqual({
      'budget.amount.amount_minor': ['budget is below the 100 minor-unit minimum'],
    })
    expect(mapped.formMessages).toEqual([])
  })

  it('maps indexed text paths through the draft entry order', () => {
    const mapped = mapViolations(schema, draft, [
      { code: 'invalid', field_path: 'texts[1].headline', message: 'headline exceeds the limit' },
    ])
    expect(mapped.fieldMessages['texts[1].headline']).toEqual(['headline exceeds the limit'])
  })

  it('maps bare targeting to fieldMessages and not formMessages', () => {
    const mapped = mapViolations(schema, draft, [
      {
        code: 'invalid',
        field_path: 'targeting',
        message: 'at least one targeting dimension required',
      },
    ])
    expect(mapped.fieldMessages.targeting).toEqual(['at least one targeting dimension required'])
    expect(mapped.formMessages).toEqual([])
  })

  it('surfaces an unmapped violation at form level rather than swallowing it', () => {
    const mapped = mapViolations(schema, draft, [
      {
        code: 'unsupported',
        field_path: 'ad_groups[0].targeting.dimensions.zork',
        message: 'targeting dimension is unavailable for this platform',
      },
    ])
    expect(mapped.fieldMessages).toEqual({})
    expect(mapped.formMessages).toEqual(['targeting dimension is unavailable for this platform'])
  })
})

describe('CapabilityForm rendering (from matrix data alone)', () => {
  /** Option lists carry the placeholder entry in front of the matrix values. */
  function selectValues(label: RegExp | string): string[] {
    return [...screen.getByLabelText(label).querySelectorAll('option')]
      .map((option) => option.value)
      .filter((value) => value !== '')
  }

  it('renders structurally different forms for two fixture platforms with no per-platform code', () => {
    const google = render(CapabilityForm, { props: { matrix: GOOGLE, currency: 'JPY' } })
    expect(selectValues(/^Objective/)).toEqual(GOOGLE.objectives)
    expect(selectValues(/^Budget type/)).toEqual(GOOGLE.budget_types)
    expect(screen.getByRole('group', { name: 'Targeting' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(GOOGLE.targeting_dimensions.length)
    google.unmount()

    const asymmetric = render(CapabilityForm, { props: { matrix: ASYMMETRIC } })
    expect(selectValues(/^Objective/)).toEqual(ASYMMETRIC.objectives)
    expect(selectValues(/^Budget type/)).toEqual(ASYMMETRIC.budget_types)
    expect(screen.getAllByRole('checkbox')).toHaveLength(ASYMMETRIC.targeting_dimensions.length)
    asymmetric.unmount()
  })

  it('does not render options the matrix does not offer', () => {
    render(CapabilityForm, { props: { matrix: ASYMMETRIC } })
    // Meta offers an engagement objective the asymmetric network's matrix
    // lacks — it must be absent from the DOM, not disabled.
    const metaOnlyObjective = META.objectives.find(
      (objective) => !ASYMMETRIC.objectives.includes(objective),
    )!
    expect(selectValues(/^Objective/)).not.toContain(metaOnlyObjective)
    const googleOnlyDimension = GOOGLE.targeting_dimensions.find(
      (dimension) => !ASYMMETRIC.targeting_dimensions.includes(dimension),
    )!
    const checkboxLabels = screen
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.closest('label')?.textContent?.trim())
    expect(checkboxLabels).not.toContain(googleOnlyDimension)
  })

  it('shows the per-locale counter and rejects an over-limit locale while the other passes', async () => {
    const onSubmit = vi.fn()
    render(CapabilityForm, { props: { matrix: META, currency: 'JPY', onSubmit } })

    const headline35 = 'あ'.repeat(35)
    await fireEvent.input(screen.getByLabelText(/^Campaign name/), {
      target: { value: 'Summer' },
    })
    await fireEvent.change(screen.getByLabelText(/^Objective/), {
      target: { value: META.objectives[0] },
    })
    await fireEvent.change(screen.getByLabelText(/^Budget type/), {
      target: { value: 'daily' },
    })
    await fireEvent.input(screen.getByLabelText(/^Budget amount/), {
      target: { value: '100' },
    })

    // English first: the counter reads the English limit, live, and 35
    // characters pass.
    expect(screen.getByText('0 / 40')).toBeInTheDocument()
    await fireEvent.input(screen.getByLabelText('Headline'), {
      target: { value: headline35 },
    })
    expect(screen.getByText('35 / 40')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)

    // Switch the text locale to Japanese: a separate entry with its own
    // counter, where the same content exceeds the limit.
    await fireEvent.change(screen.getByLabelText('Text language'), { target: { value: 'ja' } })
    expect(screen.getByText('0 / 25')).toBeInTheDocument()
    await fireEvent.input(screen.getByLabelText('Headline'), {
      target: { value: headline35 },
    })
    expect(screen.getByText('35 / 25')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(1) // unchanged — the failed submit never fires
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('maps a server violation carrying a field path onto that input, and shows unmapped ones at form level', async () => {
    render(CapabilityForm, {
      props: {
        matrix: META,
        currency: 'JPY',
        serverViolations: [
          {
            code: 'invalid',
            field_path: 'texts[0].headline',
            message: 'headline exceeds the 40-character en limit',
          },
          {
            code: 'unsupported',
            field_path: 'ad_groups[0].targeting.dimensions.zork',
            message: 'targeting dimension is unavailable for this platform',
          },
        ],
      },
    })
    expect(
      await screen.findByText('headline exceeds the 40-character en limit'),
    ).toBeInTheDocument()
    expect(screen.getByText('Some issues could not be matched to a field:')).toBeInTheDocument()
    expect(
      screen.getByText('targeting dimension is unavailable for this platform'),
    ).toBeInTheDocument()
  })

  it('renders bare targeting and per-dimension targeting violations in the targeting fieldset without duplicating in form alert', async () => {
    const selectedDimension = GOOGLE.targeting_dimensions[0]!
    render(CapabilityForm, {
      props: {
        matrix: GOOGLE,
        currency: 'JPY',
        serverViolations: [
          {
            code: 'invalid',
            field_path: 'targeting',
            message: 'at least one targeting dimension required',
          },
          {
            code: 'invalid',
            field_path: `targeting.${selectedDimension}`,
            message: `${selectedDimension} dimension is invalid`,
          },
        ],
      },
    })
    const checkbox = screen.getByRole('checkbox', { name: new RegExp(selectedDimension, 'i') })
    await fireEvent.click(checkbox)

    const targetingFieldset = screen.getByRole('group', { name: 'Targeting' })
    expect(targetingFieldset).toHaveTextContent('at least one targeting dimension required')
    expect(targetingFieldset).toHaveTextContent(`${selectedDimension} dimension is invalid`)
    expect(
      screen.queryByText('Some issues could not be matched to a field:'),
    ).not.toBeInTheDocument()
  })

  it('surfaces violations on non-active locales and marks the locale in the selector', async () => {
    const nonActiveLocale = 'ja'
    const nonActiveIndex = 1
    const message = 'headline exceeds limit for non-active locale'
    render(CapabilityForm, {
      props: {
        matrix: GOOGLE,
        currency: 'JPY',
        serverViolations: [
          {
            code: 'invalid',
            field_path: `texts[${nonActiveIndex}].headline`,
            message,
          },
        ],
      },
    })

    // Violation on non-active locale is visible in rendered output
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`\\[${nonActiveLocale}\\]`))).toBeInTheDocument()

    // Locale selector marks that locale
    const localeSelect = screen.getByLabelText('Text language') as HTMLSelectElement
    const options = [...localeSelect.options]
    const nonActiveOption = options.find((opt) => opt.value === nonActiveLocale)
    const activeOption = options.find((opt) => opt.value !== nonActiveLocale)

    expect(nonActiveOption?.textContent).toMatch(/\(has errors\)/)
    expect(activeOption?.textContent).not.toMatch(/\(has errors\)/)
  })

  it('resets the draft when the matrix changes', async () => {
    const component = render(CapabilityForm, { props: { matrix: GOOGLE } })
    await fireEvent.input(screen.getByLabelText(/^Campaign name/), { target: { value: 'kept?' } })
    await component.rerender({ matrix: META })
    expect(screen.getByLabelText(/^Campaign name/)).toHaveDisplayValue('')
  })

  it('clears client-side validation errors when the matrix changes', async () => {
    const component = render(CapabilityForm, { props: { matrix: GOOGLE, currency: 'JPY' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    await component.rerender({ matrix: META, currency: 'JPY' })
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it.each(AD_PLATFORM_FIXTURES.map((fixture) => [fixture.display_name, fixture.capability_matrix]))(
    'passes axe on the rendered form for %s',
    async (_name, matrix) => {
      const { container } = render(CapabilityForm, { props: { matrix, currency: 'JPY' } })
      expect(await axe(container)).toHaveNoViolations()
    },
  )
})
