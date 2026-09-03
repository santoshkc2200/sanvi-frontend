/**
 * Matrix → field schema. The single translation point between the
 * backend-provided capability matrix and the rendered form: a field exists
 * in the schema only when the matrix says the platform can express it —
 * absence in the matrix is absence in the DOM, never a disabled input.
 *
 * Nothing in this file (or anywhere down the render path) names an
 * objective, budget kind, locale, limit, or placement: those arrive as
 * data. The `check:boundaries` platform-literal gate fails the build if a
 * literal ever appears here.
 */
import type { AdCapabilityMatrix, CampaignFormDraft } from './types'

/** Path constants follow the backend campaign validator's `field_path` vocabulary. */
export const FIELD_PATHS = {
  budgetAmount: 'budget.amount.amount_minor',
  budgetKind: 'budget.kind',
  name: 'name',
  objective: 'objective',
  targeting: 'targeting',
  /** Path for text entry `i`'s field `field`, as the backend emits it. */
  textEntry: (index: number, field: string): string => `texts[${index}].${field}`,
} as const

/**
 * The fallback entry key the backend's `text_limit` resolves to for locales
 * with no explicit entry. Its keys are *field names*, not locales.
 */
const DEFAULT_LIMITS_ENTRY = 'default'

export interface TextEntrySchema {
  /** Fields offered for a locale with no explicit entry, if the matrix has one. */
  defaultFields?: Record<string, number>
  /** Per explicit content locale, the fields the platform can express there. */
  fieldsByLocale: Record<string, Record<string, number>>
  /** Content locales the form offers, in matrix order, `default` excluded. */
  locales: string[]
}

export interface CampaignFormSchema {
  budgetKinds: string[]
  /** Currency code → budget kind → minimum in minor units (matrix data). */
  minimumBudgets: AdCapabilityMatrix['minimum_budgets_minor']
  matrixVersion: string
  objectiveOptions: string[]
  targetingOptions: string[]
  texts: TextEntrySchema
}

/**
 * A brand-new draft with one empty text entry per offered content locale, in
 * schema order — so entry indexes are stable for the form's lifetime and
 * match the `texts[i]` paths the backend's violations use.
 */
export function emptyDraft(schema: CampaignFormSchema): CampaignFormDraft {
  return {
    budgetAmountMinor: '',
    budgetKind: '',
    name: '',
    objective: '',
    targeting: [],
    texts: schema.texts.locales.map((locale) => ({ locale, values: {} })),
  }
}

/**
 * The text fields available for one content locale. A locale with an
 * explicit limits entry resolves to exactly that entry — a field it omits is
 * unavailable *for that locale* even when the default entry has it, matching
 * the backend's `text_limit` (`get(locale)` wins over `get(default)`
 * wholesale). Locales with no entry fall back to the default entry's fields.
 */
export function textFieldsFor(texts: TextEntrySchema, locale: string): Record<string, number> {
  return texts.fieldsByLocale[locale] ?? texts.defaultFields ?? {}
}

/**
 * Builds the form schema from a matrix. Results are memoized per
 * `matrix_version` + content digest (+ optional caller key) — the catalog is
 * refetched while matrices stay version-stable, and rebuilding an identical
 * schema per refetch would churn every downstream `$derived` for no change.
 * The content digest keeps two platforms that ship the same version string
 * from sharing one entry; the optional `cacheKey` lets a caller force
 * separation it knows about (e.g. a platform key) without waiting for a
 * version bump.
 */
export function campaignFormSchema(
  matrix: AdCapabilityMatrix,
  cacheKey?: string,
): CampaignFormSchema {
  const key = `${cacheKey ?? ''}@${matrix.matrix_version}@${contentDigest(matrix)}`
  const cached = schemaCache.get(key)
  if (cached) return cached

  const schema = build(matrix)
  schemaCache.set(key, schema)
  if (schemaCache.size > CACHE_LIMIT) {
    // Bounded: drop the oldest entry rather than grow without limit across
    // tenant lifetimes in a long-lived tab.
    const oldest = schemaCache.keys().next().value
    if (oldest !== undefined) schemaCache.delete(oldest)
  }
  return schema
}

const CACHE_LIMIT = 32
const schemaCache = new Map<string, CampaignFormSchema>()

/** The memoization key for a matrix — exported so components can watch it. */
export function schemaCacheKey(matrix: AdCapabilityMatrix, cacheKey?: string): string {
  return `${cacheKey ?? ''}@${matrix.matrix_version}@${contentDigest(matrix)}`
}

/** djb2 over the stable-key JSON encoding — collision-tested enough for a 32-entry presentation cache. */
function contentDigest(matrix: AdCapabilityMatrix): string {
  const json = JSON.stringify(matrix, Object.keys(matrix).sort())
  let hash = 5381
  for (let i = 0; i < json.length; i += 1) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

function build(matrix: AdCapabilityMatrix): CampaignFormSchema {
  const fieldsByLocale: Record<string, Record<string, number>> = {}
  for (const [locale, limits] of Object.entries(matrix.text_limits)) {
    if (locale === DEFAULT_LIMITS_ENTRY) continue
    fieldsByLocale[locale] = { ...limits }
  }

  return {
    budgetKinds: [...matrix.budget_types],
    minimumBudgets: matrix.minimum_budgets_minor,
    matrixVersion: matrix.matrix_version,
    objectiveOptions: [...matrix.objectives],
    targetingOptions: [...matrix.targeting_dimensions],
    texts: {
      defaultFields: matrix.text_limits[DEFAULT_LIMITS_ENTRY],
      fieldsByLocale,
      locales: Object.keys(fieldsByLocale),
    },
  }
}

/** The inclusive character limit for one entry, or undefined when unlimited. */
export function textLimit(
  texts: TextEntrySchema,
  locale: string,
  field: string,
): number | undefined {
  return textFieldsFor(texts, locale)[field]
}

/** Code-point count — a Japanese string's length is its characters, not its UTF-16 units. */
export function codePointLength(value: string): number {
  return [...value].length
}
