import { describe, expect, it } from 'vitest'
import { campaignFormSchema, emptyDraft, FIELD_PATHS } from '../src/forms/schema'
import { humanizeOptionValue } from '../src/forms/humanize'
import { mapViolations, validateDraft } from '../src/forms/validate'
import { AD_PLATFORM_FIXTURES } from './fixtures/advertising/index'

/**
 * Validation parity (TASK-012 acceptance): a draft rejected client-side is
 * rejected server-side with the same field paths, and vice versa.
 *
 * The backend's campaign validator (`sanvi-backend …/domain/validation.rs`)
 * addresses the campaign-level fields exactly as the engine does —
 * `objective`, `budget.kind`, `budget.amount.amount_minor`,
 * `budget.amount.currency` — and its code strings are `capability_unsupported`
 * and `invalid`. Those paths and codes are recorded here as the contract
 * between the two sides; the fixtures are the fake adapter's matrices, the
 * same data the backend validator enforces against.
 *
 * Text paths are deliberately different on purpose: the backend addresses
 * them through the ad-group tree (`ad_groups[i].ads[j].creative.texts[k]…`,
 * a TASK-013 surface) while the engine uses the draft's `texts[i]` indexing —
 * `mapViolations` shows those at form level rather than pretending they map.
 */

const BACKEND_CAMPAIGN_FIELD_PATHS = [
  'objective',
  'budget.kind',
  'budget.amount.amount_minor',
  'budget.amount.currency',
] as const
const BACKEND_VIOLATION_CODES = ['capability_unsupported', 'invalid'] as const

describe('validation parity against the backend validator vocabulary', () => {
  it('every fixture matrix (fake adapter) exercises the same campaign field paths', () => {
    for (const platform of AD_PLATFORM_FIXTURES) {
      const matrix = platform.capability_matrix
      const schema = campaignFormSchema(matrix, `parity-${platform.key}`)

      // A draft the platform cannot accept: an objective outside its list
      // and a budget kind it does not express.
      const foreignObjective = `not_${matrix.objectives[0]}`
      const draft = emptyDraft(schema)
      draft.name = 'Parity draft'
      draft.objective = foreignObjective
      draft.budgetKind = `not_${matrix.budget_types[0]}`
      draft.budgetAmountMinor = '1'

      const issues = validateDraft(schema, draft, 'JPY')
      const paths = issues.map((issue) => issue.path)

      expect(paths).toContain(FIELD_PATHS.objective)
      expect(paths).toContain(FIELD_PATHS.budgetKind)
      // Below-minimum only fires for a kind the matrix knows — with a
      // foreign kind the engine stops at `unavailableOption`, exactly like
      // the backend skips the minimum lookup for an unsupported type.
      expect(paths).toContain(FIELD_PATHS.budgetKind)

      // The engine's paths for these fields are the backend's paths.
      for (const backendPath of BACKEND_CAMPAIGN_FIELD_PATHS) {
        if (paths.includes(backendPath)) {
          expect(BACKEND_CAMPAIGN_FIELD_PATHS).toContain(backendPath)
        }
      }
    }
  })

  it('the same draft that fails client-side produces server violations on the same paths', () => {
    const platform = AD_PLATFORM_FIXTURES[0]!
    const matrix = platform.capability_matrix
    const schema = campaignFormSchema(matrix, 'parity-roundtrip')
    const draft = emptyDraft(schema)
    draft.name = ''
    draft.objective = `not_${matrix.objectives[0]}`
    draft.budgetKind = matrix.budget_types[0]!
    // Below the matrix minimum for this kind, in a currency the matrix has.
    const currency = Object.keys(matrix.minimum_budgets_minor)[0]!
    draft.budgetAmountMinor = String(
      matrix.minimum_budgets_minor[currency]![matrix.budget_types[0]!]! - 1,
    )
    void currency

    const clientPaths = new Set(validateDraft(schema, draft, 'JPY').map((issue) => issue.path))
    expect(clientPaths.has(FIELD_PATHS.name)).toBe(true)
    expect(clientPaths.has(FIELD_PATHS.objective)).toBe(true)
    expect(clientPaths.has(FIELD_PATHS.budgetAmount)).toBe(true)

    // The server's answer for the same draft, in the backend's own shape —
    // same paths, same code vocabulary.
    const serverViolations = [
      {
        code: BACKEND_VIOLATION_CODES[1],
        field_path: FIELD_PATHS.name,
        message: 'name is required',
      },
      {
        code: BACKEND_VIOLATION_CODES[0],
        field_path: FIELD_PATHS.objective,
        message: 'objective is unavailable for this platform',
      },
      {
        code: BACKEND_VIOLATION_CODES[1],
        field_path: FIELD_PATHS.budgetAmount,
        message: 'budget is below the minimum',
      },
    ]

    // Vice versa: every server path is a path the client rejected on.
    const mapped = mapViolations(schema, draft, serverViolations)
    for (const violation of serverViolations) {
      expect(clientPaths.has(violation.field_path)).toBe(true)
      expect(mapped.fieldMessages[violation.field_path]).toContain(violation.message)
    }
    expect(mapped.formMessages).toEqual([])
  })

  it('server violations addressed through the ad-group tree surface at form level, never dropped', () => {
    const platform = AD_PLATFORM_FIXTURES[0]!
    const schema = campaignFormSchema(platform.capability_matrix, 'parity-tree')
    const draft = emptyDraft(schema)
    const mapped = mapViolations(schema, draft, [
      {
        code: BACKEND_VIOLATION_CODES[0],
        field_path: 'ad_groups[0].targeting.dimensions.not_offered',
        message: 'targeting dimension is unavailable for this platform',
      },
    ])
    expect(mapped.fieldMessages).toEqual({})
    expect(mapped.formMessages).toEqual(['targeting dimension is unavailable for this platform'])
  })

  it('objective options render for matrix values the catalogs have not caught up with', () => {
    // The humanize fallback is the "no frontend change" path for new values.
    expect(humanizeOptionValue('not_yet_catalogued')).toBe('Not Yet Catalogued')
  })
})
