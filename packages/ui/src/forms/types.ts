/**
 * Phase 10 advertising form engine — the types everything else speaks.
 *
 * `AdCapabilityMatrix` structurally mirrors the generated contract's
 * `CapabilityMatrix` schema. It is redeclared here, not imported, because
 * `@sanvi/ui` never imports `@sanvi/api-client` (repo non-negotiable #4);
 * structural typing keeps the two in lockstep — the api-client type is
 * assignable to this one, so an app passes contract data straight in.
 * If the contract grows a matrix field, this shape gains it in the same
 * slice that regenerates the client.
 *
 * None of the string values below — objective names, budget kinds, locales,
 * limits — exist as literals anywhere in engine code: they arrive as data
 * from the backend-provided matrix, which is the only source (NFR-1001).
 */

/** One creative placement's asset requirements, verbatim matrix data. */
export interface AdAssetSpec {
  aspect_ratios: string[]
  image_required: boolean
  max_duration_seconds?: number | null
  max_file_size_bytes?: number | null
  min_duration_seconds?: number | null
  min_height_px?: number | null
  min_width_px?: number | null
  video_allowed: boolean
}

/** One creative placement, verbatim matrix data. */
export interface AdCreativePlacement {
  asset_spec: AdAssetSpec
  key: string
}

/**
 * The versioned capability matrix as the backend's validator and this form
 * engine both consume it.
 */
export interface AdCapabilityMatrix {
  budget_types: string[]
  creative_placements: AdCreativePlacement[]
  matrix_version: string
  /** Currency code → budget kind → inclusive minimum, in minor units. */
  minimum_budgets_minor: Record<string, Record<string, number>>
  objectives: string[]
  schedule_granularity: string
  targeting_dimensions: string[]
  /** Locale → text field name → inclusive character limit. */
  text_limits: Record<string, Record<string, number>>
}

/** The catalog entry one {@link AdPlatformCard} renders. Mirrors `PlatformView`. */
export interface AdPlatform {
  available: boolean
  capability_matrix: AdCapabilityMatrix
  /** Adapter-owned connection state; display naming is caller-provided data. */
  connection_state: string
  display_name: string
  entitlement_key: string
  key: string
  upgrade_required: boolean
}

/**
 * What the form is editing. Field shapes follow the backend campaign
 * validator's `field_path` vocabulary (`objective`, `budget.kind`,
 * `budget.amount.amount_minor`, `texts[i].<field>`) so a server violation
 * maps onto an input without translation.
 *
 * `budgetAmountMinor` stays a string — it is bound to a text input and
 * parsed by validation, so a half-typed value never silently becomes a
 * number. `texts` holds one entry per content locale, in the order the
 * draft will be submitted; the index in that array is the `i` in the
 * backend's `texts[i].<field>` paths.
 */
export interface CampaignFormDraft {
  budgetAmountMinor: string
  budgetKind: string
  name: string
  objective: string
  targeting: string[]
  texts: CampaignFormTextEntry[]
}

/** One content locale's localized text fields (e.g. headline and body). */
export interface CampaignFormTextEntry {
  /** Field name → content, exactly the names the matrix's `text_limits` use. */
  values: Record<string, string>
  /** The content locale this entry is written in. */
  locale: string
}

/**
 * A client-side validation issue: a machine-readable code plus the field
 * path it belongs to. The component turns codes into rendered messages via
 * its labels — `@sanvi/ui` stays free of both `@sanvi/i18n` and hardcoded
 * copy.
 */
export interface FormIssue {
  code: 'required' | 'integer' | 'belowMinimum' | 'tooLong' | 'unavailableOption'
  limit?: number
  /** Only set on numeric issues (`belowMinimum`), in minor units. */
  minimum?: number
  current?: number
  path: string
}

/** A violation as the backend's `ValidationResultView` carries it. */
export interface ServerViolation {
  code: string
  field_path: string
  message: string
}

/** The result of mapping server violations onto the form. */
export interface MappedViolations {
  /** Path → verbatim backend messages, one per mapped field. */
  fieldMessages: Record<string, string[]>
  /** Backend messages whose `field_path` matched no rendered field. */
  formMessages: string[]
}
