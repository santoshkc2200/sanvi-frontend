/**
 * Client-side validation and server-violation mapping for the capability
 * form. The rules mirror — from the same matrix data — what the backend's
 * campaign validator enforces, so a tenant sees an error in the form rather
 * than as an API failure after a long wait. The server stays authoritative:
 * its violations land on the same fields by path, and anything the client
 * did not predict is shown, never swallowed.
 */
import { codePointLength, FIELD_PATHS, textFieldsFor, type CampaignFormSchema } from './schema'
import type { CampaignFormDraft, FormIssue, MappedViolations, ServerViolation } from './types'

/**
 * Validates a draft against the schema. `currency` (the ad account's
 * currency, data the matrix does not carry) gates the minimum-budget check:
 * without it a minimum exists but cannot be attributed, so it is skipped —
 * the backend still enforces it.
 */
export function validateDraft(
  schema: CampaignFormSchema,
  draft: CampaignFormDraft,
  currency?: string,
): FormIssue[] {
  const issues: FormIssue[] = []

  if (draft.name.trim() === '') {
    issues.push({ code: 'required', path: FIELD_PATHS.name })
  }

  if (draft.objective === '') {
    issues.push({ code: 'required', path: FIELD_PATHS.objective })
  } else if (!schema.objectiveOptions.includes(draft.objective)) {
    issues.push({ code: 'unavailableOption', path: FIELD_PATHS.objective })
  }

  if (draft.budgetKind === '') {
    issues.push({ code: 'required', path: FIELD_PATHS.budgetKind })
  } else if (!schema.budgetKinds.includes(draft.budgetKind)) {
    issues.push({ code: 'unavailableOption', path: FIELD_PATHS.budgetKind })
  }

  if (draft.budgetAmountMinor.trim() === '') {
    issues.push({ code: 'required', path: FIELD_PATHS.budgetAmount })
  } else if (!/^\d+$/.test(draft.budgetAmountMinor.trim())) {
    issues.push({ code: 'integer', path: FIELD_PATHS.budgetAmount })
  } else {
    const minimum = minimumFor(schema, currency, draft.budgetKind)
    if (minimum !== undefined && Number(draft.budgetAmountMinor.trim()) < minimum) {
      issues.push({ code: 'belowMinimum', minimum, path: FIELD_PATHS.budgetAmount })
    }
  }

  for (const entry of draft.texts) {
    const limits = textFieldsFor(schema.texts, entry.locale)
    for (const [field, limit] of Object.entries(limits)) {
      const current = codePointLength(entry.values[field] ?? '')
      if (current > limit) {
        issues.push({
          code: 'tooLong',
          current,
          limit,
          path: FIELD_PATHS.textEntry(draft.texts.indexOf(entry), field),
        })
      }
    }
  }

  return issues
}

/** The matrix minimum for a currency and budget kind, when the matrix defines one. */
export function minimumFor(
  schema: CampaignFormSchema,
  currency: string | undefined,
  budgetKind: string,
): number | undefined {
  if (!currency) return undefined
  return schema.minimumBudgets[currency]?.[budgetKind]
}

/**
 * Maps backend violations onto rendered fields by `field_path`, verbatim
 * messages. Paths that match no rendered field surface at form level — an
 * unmapped violation is information the tenant still needs, not noise to
 * drop.
 *
 * Text paths arrive indexed (`texts[1].headline`); the index is resolved
 * through the draft's entry order. A path referencing an entry the draft
 * does not have is unmapped by design — there is no input to attach it to.
 */
export function mapViolations(
  schema: CampaignFormSchema,
  draft: CampaignFormDraft,
  violations: ServerViolation[],
): MappedViolations {
  const fieldMessages: Record<string, string[]> = {}
  const formMessages: string[] = []
  const knownPaths = new Set<string>([
    FIELD_PATHS.name,
    FIELD_PATHS.objective,
    FIELD_PATHS.budgetKind,
    FIELD_PATHS.budgetAmount,
    ...draft.targeting.map((dimension) => `${FIELD_PATHS.targeting}.${dimension}`),
  ])
  draft.texts.forEach((entry, index) => {
    for (const field of Object.keys(textFieldsFor(schema.texts, entry.locale))) {
      knownPaths.add(FIELD_PATHS.textEntry(index, field))
    }
  })

  for (const violation of violations) {
    if (knownPaths.has(violation.field_path)) {
      const existing = fieldMessages[violation.field_path]
      if (existing) {
        existing.push(violation.message)
      } else {
        fieldMessages[violation.field_path] = [violation.message]
      }
    } else {
      formMessages.push(violation.message)
    }
  }

  return { fieldMessages, formMessages }
}
