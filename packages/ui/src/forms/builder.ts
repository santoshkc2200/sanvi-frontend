/**
 * Stepper composition for the capability form engine (phase 10, TASK-012).
 *
 * The campaign builder is one form engine split across steps. Everything
 * here is derived from the same matrix-built {@link CampaignFormSchema} the
 * single-page form uses — step *existence* is matrix-driven (a platform with
 * no targeting dimensions has no targeting step), and step validation is
 * plain `validateDraft` filtered to the step's field paths, so a step can
 * never accept what the full form (or the backend) would reject.
 *
 * The payload builders close the gap between the engine's draft (a string
 * budget, indexed text entries) and the contract's request bodies — without
 * importing the contract (this package never imports the data layer); the
 * outputs are structurally assignable to the generated request types.
 *
 * Autosave stores the draft under a key bound to what the draft *is* (the
 * connection being built against, or the campaign being edited) plus the
 * matrix version it was entered under; a stale or foreign envelope is
 * discarded on load rather than partially applied.
 */
import { FIELD_PATHS, type CampaignFormSchema } from './schema'
import { validateDraft } from './validate'
import type { CampaignFormDraft, FormIssue } from './types'

/** Step identities. None of these is matrix data — they are the fixed rails the matrix-driven fields hang on. */
export type BuilderStepId = 'basics' | 'targeting' | 'budget' | 'creatives' | 'review'

/** The ordered steps for a schema: matrix-absent sections do not get a step. */
export function builderSteps(
  schema: CampaignFormSchema,
  options?: { mode?: 'new' | 'edit' },
): BuilderStepId[] {
  const steps: BuilderStepId[] = ['basics']
  if (schema.targetingOptions.length > 0 && options?.mode !== 'edit') {
    steps.push('targeting')
  }
  steps.push('budget', 'creatives', 'review')
  return steps
}

/**
 * The field paths a step owns, in the engine's `field_path` vocabulary. The
 * review step owns everything (it is the last gate before submit), which
 * falls out naturally from the empty intersection below.
 */
function stepIssuePaths(step: BuilderStepId, schema: CampaignFormSchema): Set<string> {
  const paths = new Set<string>()
  if (step === 'basics' || step === 'review') {
    paths.add(FIELD_PATHS.name)
    paths.add(FIELD_PATHS.objective)
  }
  if (step === 'targeting') {
    for (const dimension of schema.targetingOptions) {
      paths.add(`${FIELD_PATHS.targeting}.${dimension}`)
    }
  }
  if (step === 'budget' || step === 'review') {
    paths.add(FIELD_PATHS.budgetKind)
    paths.add(FIELD_PATHS.budgetAmount)
  }
  return paths
}

/**
 * Client-side validation for one step: the same rules as the whole-form
 * validation, narrowed to the step's fields. Empty means the step may be
 * left; the review step re-validates everything before submit regardless of
 * how each step was exited.
 */
export function validateStep(
  schema: CampaignFormSchema,
  draft: CampaignFormDraft,
  step: BuilderStepId,
  currency?: string,
): FormIssue[] {
  const issues = validateDraft(schema, draft, currency)
  if (step === 'review') return issues
  const owned = stepIssuePaths(step, schema)
  return issues.filter((issue) => owned.has(issue.path))
}

// ---------------------------------------------------------------------------
// Contract payloads — structural twins of the generated request bodies.
// ---------------------------------------------------------------------------

export interface BuilderSchedule {
  startsAt: string | null
  endsAt: string | null
}

/** Structural twin of the contract's `CreateCampaignRequest`. */
export interface CreateCampaignPayload {
  name: string
  objective: string
  connection_id: string
  budget: { kind: string; amount: { amount_minor: number; currency: string } }
  schedule: { starts_at: string | null; ends_at: string | null } | null
}

/**
 * Structural twin of the contract's `CreateAdGroupRequest` — the builder
 * seeds one ad group carrying the targeting step's selection, because the
 * contract keeps targeting on ad groups, not on the campaign.
 */
export interface SeedAdGroupPayload {
  name: string
  bid: { strategy: string; maximum_bid: null }
  targeting: { dimensions: Record<string, string[]>; extension_fields: Record<string, string> }
}

/** Structural twin of the contract's `PatchCampaignRequest` (schedule included). */
export interface PatchCampaignPayload {
  name: string
  objective: string
  budget: { kind: string; amount: { amount_minor: number; currency: string } } | null
  schedule: { starts_at: string | null; ends_at: string | null } | null
}

/**
 * The campaign create payload from a validated draft. Callers validate first
 * (`validateStep(..., 'review')` empty); the budget has been parsed here so
 * a non-numeric value cannot reach the wire as `NaN`.
 */
export function draftToCreatePayload(
  draft: CampaignFormDraft,
  options: { connectionId: string; currency: string; schedule: BuilderSchedule },
): CreateCampaignPayload {
  const hasSchedule = options.schedule.startsAt !== null || options.schedule.endsAt !== null
  return {
    name: draft.name.trim(),
    objective: draft.objective,
    connection_id: options.connectionId,
    budget: {
      kind: draft.budgetKind,
      amount: { amount_minor: Number(draft.budgetAmountMinor.trim()), currency: options.currency },
    },
    schedule: hasSchedule
      ? { starts_at: options.schedule.startsAt, ends_at: options.schedule.endsAt }
      : null,
  }
}

/**
 * The initial ad group carrying the targeting selection. `maximum_bid` is
 * deliberately null — this slice sets no bid; the generic strategy label
 * matches the backend's own fixtures, and per-platform strategies are matrix
 * data this engine has never been given.
 */
export function seedAdGroupPayload(
  draft: CampaignFormDraft,
  nameLabel: string,
): SeedAdGroupPayload | undefined {
  if (draft.targeting.length === 0) return undefined
  const dimensions: Record<string, string[]> = {}
  for (const dimension of draft.targeting) dimensions[dimension] = []
  return {
    name: nameLabel,
    bid: { strategy: 'manual', maximum_bid: null },
    targeting: { dimensions, extension_fields: {} },
  }
}

/**
 * The full-snapshot patch payload for saving an edited campaign. Merge-patch
 * semantics mean every present field overwrites — which is what "save" means
 * here; the schedule is `null` when both bounds are cleared, because the
 * contract expresses "no schedule" that way.
 */
export function draftToPatchPayload(
  draft: CampaignFormDraft,
  options: { currency: string; schedule: BuilderSchedule },
): PatchCampaignPayload {
  const hasSchedule = options.schedule.startsAt !== null || options.schedule.endsAt !== null
  return {
    name: draft.name.trim(),
    objective: draft.objective,
    budget: {
      kind: draft.budgetKind,
      amount: { amount_minor: Number(draft.budgetAmountMinor.trim()), currency: options.currency },
    },
    schedule: hasSchedule
      ? { starts_at: options.schedule.startsAt, ends_at: options.schedule.endsAt }
      : null,
  }
}

/** Structural subset of the contract's `Campaign` the draft is restored from. */
export interface CampaignSnapshot {
  name: string
  objective: string
  budget: { kind: string; amount: { amount_minor: number; currency: string } }
  /** The contract makes schedule optional on the campaign; absent means none. */
  schedule?: { starts_at?: string | null; ends_at?: string | null } | null
}

/**
 * Rebuilds the form draft from a stored campaign (edit mode). Text entries
 * stay empty: creative copy lives on ads, which this slice's builder does
 * not edit — the engine's per-locale text step is TASK-013's surface.
 */
export function draftFromCampaign(
  campaign: CampaignSnapshot,
  schema: CampaignFormSchema,
): { draft: CampaignFormDraft; schedule: BuilderSchedule } {
  const draft: CampaignFormDraft = {
    budgetAmountMinor: String(campaign.budget.amount.amount_minor),
    budgetKind: schema.budgetKinds.includes(campaign.budget.kind) ? campaign.budget.kind : '',
    name: campaign.name,
    objective: schema.objectiveOptions.includes(campaign.objective) ? campaign.objective : '',
    targeting: [],
    texts: schema.texts.locales.map((locale) => ({ locale, values: {} })),
  }
  return {
    draft,
    schedule: {
      startsAt: campaign.schedule?.starts_at ?? null,
      endsAt: campaign.schedule?.ends_at ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// Autosave — a refresh mid-builder must resume with every value intact.
// ---------------------------------------------------------------------------

export interface BuilderAutosave {
  version: 1
  matrixVersion: string
  savedAt: string
  step: BuilderStepId
  draft: CampaignFormDraft
  schedule: BuilderSchedule
}

const AUTOSAVE_VERSION = 1

/** Storage key for one builder session: what the draft belongs to, namespaced. */
export function builderAutosaveKey(scope: 'new' | 'edit', id: string): string {
  return `sanvi.adbuilder.${scope}.${id}`
}

export function saveBuilderAutosave(
  storage: Storage | undefined,
  key: string,
  value: Omit<BuilderAutosave, 'version' | 'savedAt'>,
): void {
  if (!storage) return
  const envelope: BuilderAutosave = {
    ...value,
    version: AUTOSAVE_VERSION,
    savedAt: new Date().toISOString(),
  }
  try {
    storage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Quota/private-mode failures must never break typing in the form.
  }
}

/**
 * Loads an autosave only when its envelope and matrix version both match —
 * a draft entered against an older matrix is discarded wholesale rather
 * than partially applied against fields that may no longer exist.
 */
export function loadBuilderAutosave(
  storage: Storage | undefined,
  key: string,
  matrixVersion: string,
): BuilderAutosave | undefined {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as BuilderAutosave
    if (parsed?.version !== AUTOSAVE_VERSION || parsed?.matrixVersion !== matrixVersion) {
      return undefined
    }
    if (
      typeof parsed.draft?.name !== 'string' ||
      typeof parsed.draft?.budgetAmountMinor !== 'string' ||
      !Array.isArray(parsed.draft?.texts) ||
      !Array.isArray(parsed.draft?.targeting)
    ) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

export function clearBuilderAutosave(storage: Storage | undefined, key: string): void {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Same contract as save: persistence failures never break the form.
  }
}
