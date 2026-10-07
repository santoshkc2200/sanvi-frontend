/**
 * Creative asset-spec validation (phase 10, TASK-013) — the client half of
 * the backend's upload-time validation, running against the same matrix
 * data so a tenant learns "this asset is 500×888 and stories needs ≥500×888"
 * at upload, not as an API failure after the fact. The backend stays
 * authoritative; its dimension vocabulary (`aspect_ratio`, `width_px`,
 * `height_px`, `file_size_bytes`, `duration_seconds`, `is_video`) and its
 * 1 % aspect-ratio tolerance are mirrored here exactly.
 *
 * Nothing in this file names a platform, placement, or limit: specs and
 * their values arrive as data (NFR-1001 — the grep gate enforces it).
 */
import type { AdAssetSpec } from '../forms/types'

/** Structural twin of the contract's `AssetMetadata`, as the client measures it. */
export interface AdAssetMetadata {
  aspect_ratio: string
  file_size_bytes: number
  height_px: number
  is_video: boolean
  duration_seconds?: number | null
  width_px: number
}

/** Reduced W:H string ("4:5") from measured pixel dimensions. */
export function aspectRatioFromDimensions(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return '1:1'
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

/** Builds the measured metadata the validators (client and backend) both consume. */
export function assetMetadataFromMeasured(measured: {
  width: number
  height: number
  fileSizeBytes: number
  contentType: string
  durationSeconds?: number | null
}): AdAssetMetadata {
  return {
    aspect_ratio: aspectRatioFromDimensions(measured.width, measured.height),
    file_size_bytes: measured.fileSizeBytes,
    height_px: measured.height,
    is_video: measured.contentType.startsWith('video/'),
    duration_seconds: measured.durationSeconds ?? null,
    width_px: measured.width,
  }
}

/**
 * `W:H` as a number, mirroring the backend's `parse_aspect_ratio`: both sides
 * are parsed as floats, so a decimal ratio (`1.91:1`, which several
 * placements use) is as valid here as it is there. An integers-only reader
 * would reject every asset for such a placement while the backend accepted
 * it, leaving the form unsubmittable.
 */
function parseAspectRatio(ratio: string): number | undefined {
  const separator = ratio.indexOf(':')
  if (separator < 0) return undefined
  const width = numericSide(ratio.slice(0, separator))
  const height = numericSide(ratio.slice(separator + 1))
  if (width === undefined || height === undefined) return undefined
  return width / height
}

/** One side of a ratio — a finite, positive decimal, and nothing else. */
function numericSide(raw: string): number | undefined {
  const trimmed = raw.trim()
  // `Number('')` is 0 and `Number('1e3')`/`Number('0x10')` are not ratio
  // syntax, so the shape is checked before the value.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** The dimension a failing asset check is named after — the backend's vocabulary. */
export type AdAssetSpecDimension =
  | 'aspect_ratio'
  | 'duration_seconds'
  | 'file_size_bytes'
  | 'height_px'
  | 'is_video'
  | 'width_px'

export interface AdAssetSpecIssue {
  dimension: AdAssetSpecDimension
  /** What the asset measures, formatted for display. */
  actual?: string | number
  /** What the spec demands, formatted for display. */
  required?: string | number
}

const ASPECT_RATIO_TOLERANCE = 0.01

/**
 * One asset against one placement's spec. Mirrors the backend's
 * `CreativeAssetSpec::validate_asset` rule for rule, dimension for
 * dimension — a diff between the two would make the form and the API
 * disagree about what is shippable.
 */
export function validateAssetAgainstSpec(
  metadata: AdAssetMetadata,
  spec: AdAssetSpec,
): AdAssetSpecIssue[] {
  const issues: AdAssetSpecIssue[] = []

  if (!spec.video_allowed && metadata.is_video) {
    issues.push({ dimension: 'is_video', actual: 'video' })
  }

  const declared = parseAspectRatio(metadata.aspect_ratio)
  if (declared === undefined) {
    issues.push({ dimension: 'aspect_ratio', actual: metadata.aspect_ratio })
  } else if (spec.aspect_ratios.length > 0) {
    const matchesAllowed = spec.aspect_ratios.some((allowed) => {
      const specRatio = parseAspectRatio(allowed)
      return (
        specRatio !== undefined &&
        Math.abs(declared - specRatio) / specRatio <= ASPECT_RATIO_TOLERANCE
      )
    })
    if (!matchesAllowed) {
      issues.push({
        dimension: 'aspect_ratio',
        actual: metadata.aspect_ratio,
        required: spec.aspect_ratios.join(', '),
      })
    }
  }

  if (
    spec.min_width_px !== null &&
    spec.min_width_px !== undefined &&
    metadata.width_px < spec.min_width_px
  ) {
    issues.push({
      dimension: 'width_px',
      actual: metadata.width_px,
      required: spec.min_width_px,
    })
  }
  if (
    spec.min_height_px !== null &&
    spec.min_height_px !== undefined &&
    metadata.height_px < spec.min_height_px
  ) {
    issues.push({
      dimension: 'height_px',
      actual: metadata.height_px,
      required: spec.min_height_px,
    })
  }
  if (
    spec.max_file_size_bytes !== null &&
    spec.max_file_size_bytes !== undefined &&
    metadata.file_size_bytes > spec.max_file_size_bytes
  ) {
    issues.push({
      dimension: 'file_size_bytes',
      actual: metadata.file_size_bytes,
      required: spec.max_file_size_bytes,
    })
  }

  if (metadata.is_video) {
    const hasBounds =
      (spec.min_duration_seconds !== null && spec.min_duration_seconds !== undefined) ||
      (spec.max_duration_seconds !== null && spec.max_duration_seconds !== undefined)
    // `== null` covers both an explicit null and an absent field: metadata
    // echoed back from the API decodes a missing `duration_seconds` to
    // `undefined`, and an unknown duration must fail here rather than pass
    // the client and be rejected by the backend.
    if (metadata.duration_seconds == null && hasBounds) {
      issues.push({ dimension: 'duration_seconds' })
    } else if (metadata.duration_seconds != null) {
      if (
        spec.min_duration_seconds !== null &&
        spec.min_duration_seconds !== undefined &&
        metadata.duration_seconds < spec.min_duration_seconds
      ) {
        issues.push({
          dimension: 'duration_seconds',
          actual: metadata.duration_seconds,
          required: spec.min_duration_seconds,
        })
      } else if (
        spec.max_duration_seconds !== null &&
        spec.max_duration_seconds !== undefined &&
        metadata.duration_seconds > spec.max_duration_seconds
      ) {
        issues.push({
          dimension: 'duration_seconds',
          actual: metadata.duration_seconds,
          required: spec.max_duration_seconds,
        })
      }
    }
  }

  return issues
}

/** Whether at least one non-video asset is present (the spec's set-level image rule). */
export function hasImageAsset(assets: AdAssetMetadata[]): boolean {
  return assets.some((asset) => !asset.is_video)
}

/** The set-level rules the backend enforces once per placement, not per asset. */
export type AdAssetSetIssueCode = 'image_required'

export interface AdAssetSetIssue {
  code: AdAssetSetIssueCode
}

export function validateAssetSetAgainstSpec(
  assets: AdAssetMetadata[],
  spec: AdAssetSpec,
): AdAssetSetIssue[] {
  if (spec.image_required && !hasImageAsset(assets)) {
    return [{ code: 'image_required' }]
  }
  return []
}

// ---------------------------------------------------------------------------
// Spec requirements — structured, for callers to label
// ---------------------------------------------------------------------------

export type AdSpecRequirement =
  | { aspectRatios: string[]; kind: 'aspect_ratios' }
  | { bytes: number; kind: 'max_file_size_bytes' }
  | { kind: 'image_required' }
  | { kind: 'video_not_allowed' }
  | { kind: 'duration_range'; maxSeconds?: number | null; minSeconds?: number | null }
  | { kind: 'min_dimensions'; minWidthPx?: number | null; minHeightPx?: number | null }

/** The spec's demands as data, in a stable order, for callers to label. */
export function specRequirements(spec: AdAssetSpec): AdSpecRequirement[] {
  const requirements: AdSpecRequirement[] = []
  if (spec.image_required) requirements.push({ kind: 'image_required' })
  if (!spec.video_allowed) requirements.push({ kind: 'video_not_allowed' })
  if (spec.aspect_ratios.length > 0) {
    requirements.push({ aspectRatios: spec.aspect_ratios, kind: 'aspect_ratios' })
  }
  if (
    (spec.min_width_px !== null && spec.min_width_px !== undefined) ||
    (spec.min_height_px !== null && spec.min_height_px !== undefined)
  ) {
    requirements.push({
      kind: 'min_dimensions',
      minHeightPx: spec.min_height_px,
      minWidthPx: spec.min_width_px,
    })
  }
  if (spec.max_file_size_bytes !== null && spec.max_file_size_bytes !== undefined) {
    requirements.push({ bytes: spec.max_file_size_bytes, kind: 'max_file_size_bytes' })
  }
  if (
    (spec.min_duration_seconds !== null && spec.min_duration_seconds !== undefined) ||
    (spec.max_duration_seconds !== null && spec.max_duration_seconds !== undefined)
  ) {
    requirements.push({
      kind: 'duration_range',
      maxSeconds: spec.max_duration_seconds,
      minSeconds: spec.min_duration_seconds,
    })
  }
  return requirements
}

/** The spec's first allowed ratio as a CSS `aspect-ratio` value ("9 / 16"), for preview frames. */
export function previewFrameAspectRatio(spec: AdAssetSpec): string | undefined {
  const first = spec.aspect_ratios[0]
  if (!first) return undefined
  const separator = first.indexOf(':')
  if (separator < 0) return undefined
  const width = numericSide(first.slice(0, separator))
  const height = numericSide(first.slice(separator + 1))
  if (width === undefined || height === undefined) return undefined
  return `${width} / ${height}`
}

/**
 * Integer `width`/`height` attributes matching the preview frame's ratio
 * (TASK-022 image contract): the preview `<img>` reserves the same box the
 * frame enforces, so an uploaded creative arriving late shifts nothing.
 * Smaller side normalized to 100 — the attrs express the ratio, not a
 * rendering size.
 */
export function previewFrameDimensions(
  spec: AdAssetSpec,
): { width: number; height: number } | undefined {
  const first = spec.aspect_ratios[0]
  if (!first) return undefined
  const separator = first.indexOf(':')
  if (separator < 0) return undefined
  const width = numericSide(first.slice(0, separator))
  const height = numericSide(first.slice(separator + 1))
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return undefined
  }
  const scale = 100 / Math.min(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
