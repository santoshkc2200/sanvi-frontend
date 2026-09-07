/**
 * Presentation and spec logic for the creative manager (phase 10,
 * TASK-013) — the layer between the matrix's creative half and the
 * localized screen: per-placement asset-spec violations that name the
 * placement and the failing dimension, requirement lists a placement makes
 * of an asset, and the per-placement create payloads the contract wants.
 *
 * Placement keys, locales, and limits are matrix data throughout — labels
 * resolve through the i18n catalog by key, never a literal (the
 * platform-literal gate enforces exactly that for this file's path).
 */
import type {
  ConnectionView,
  CreateCreativeRequest,
  CreativeText,
  PlatformView,
} from '@sanvi/api-client'
import {
  assetMetadataFromMeasured,
  specRequirements,
  validateAssetAgainstSpec,
  validateAssetSetAgainstSpec,
  type AdAssetMetadata,
  type AdAssetSpec,
  type AdAssetSpecDimension,
  type AdAssetSpecIssue,
  type AdSpecRequirement,
} from '@sanvi/ui'
import { fmt, t } from '@sanvi/i18n'
import { dataLabel } from './campaigns'

/** A matrix placement with its spec, as the editor consumes it. */
export interface PlacementSpec {
  key: string
  spec: AdAssetSpec
}

/** An uploaded image and everything the spec checks need about it. */
export interface EditorAsset {
  /** The media-service asset id — the creative's asset reference. */
  id: string
  localUrl: string
  metadata: AdAssetMetadata
}

/** One placement's failure against the current asset set. */
export interface CreativeSpecViolation {
  placementKey: string
  /** Which image failed, when it is a per-asset issue. */
  assetIndex?: number
  /** `asset` issues are resolved per image; `set` issues by adding an image. */
  kind: 'asset' | 'set'
  dimension: AdAssetSpecDimension | 'image_required'
  message: string
}

export function placementLabel(key: string): string {
  return dataLabel('admin.advertising.option.', key)
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  const mib = bytes / (1024 * 1024)
  if (mib >= 1) return `${fmt.number(Math.round(mib * 10) / 10)} MB`
  return `${fmt.number(Math.max(1, Math.ceil(bytes / 1024)))} KB`
}

/**
 * "600 × 400 px" for a full pair, "600 px" for a spec that names only one
 * side — the unit belongs to the whole measurement, so a lone width must
 * carry it too rather than render as a bare number.
 */
export function formatDimensions(widthPx?: number | null, heightPx?: number | null): string {
  const parts: string[] = []
  if (widthPx !== null && widthPx !== undefined) parts.push(fmt.number(widthPx))
  if (heightPx !== null && heightPx !== undefined) parts.push(fmt.number(heightPx))
  return parts.length > 0 ? `${parts.join('×')} px` : ''
}

/** One requirement line, localized — what a placement demands of an asset. */
export function requirementText(requirement: AdSpecRequirement): string {
  switch (requirement.kind) {
    case 'image_required':
      return t['admin.advertising.creatives.req.imageRequired']()
    case 'video_not_allowed':
      return t['admin.advertising.creatives.req.videoNotAllowed']()
    case 'aspect_ratios':
      return t['admin.advertising.creatives.req.aspectRatios']({
        ratios: requirement.aspectRatios.join(' / '),
      })
    case 'min_dimensions':
      return t['admin.advertising.creatives.req.minDimensions']({
        dims: formatDimensions(requirement.minWidthPx, requirement.minHeightPx),
      })
    case 'max_file_size_bytes':
      return t['admin.advertising.creatives.req.maxFileSize']({
        size: formatBytes(requirement.bytes),
      })
    case 'duration_range': {
      const lines: string[] = []
      if (requirement.minSeconds !== null && requirement.minSeconds !== undefined) {
        lines.push(
          t['admin.advertising.creatives.req.durationMin']({ seconds: requirement.minSeconds }),
        )
      }
      if (requirement.maxSeconds !== null && requirement.maxSeconds !== undefined) {
        lines.push(
          t['admin.advertising.creatives.req.durationMax']({ seconds: requirement.maxSeconds }),
        )
      }
      return lines.join(' · ')
    }
  }
}

export function requirementLines(spec: PlacementSpec['spec']): string[] {
  return specRequirements(spec).map(requirementText)
}

// ---------------------------------------------------------------------------
// Spec feedback — which placement, which dimension
// ---------------------------------------------------------------------------

function issueMessage(placementKey: string, issue: AdAssetSpecIssue): string {
  const placement = placementLabel(placementKey)
  const params = (actual?: string | number, required?: string | number) => ({
    placement,
    actual:
      actual === undefined
        ? ''
        : typeof actual === 'number'
          ? issue.dimension === 'file_size_bytes'
            ? formatBytes(actual)
            : `${fmt.number(actual)}`
          : actual,
    required:
      required === undefined
        ? ''
        : typeof required === 'number'
          ? issue.dimension === 'file_size_bytes'
            ? formatBytes(required)
            : `${fmt.number(required)}`
          : required,
  })

  switch (issue.dimension) {
    case 'aspect_ratio':
      return t['admin.advertising.creatives.specIssue.aspectRatio'](
        params(issue.actual, issue.required),
      )
    case 'width_px':
      return t['admin.advertising.creatives.specIssue.width'](params(issue.actual, issue.required))
    case 'height_px':
      return t['admin.advertising.creatives.specIssue.height'](params(issue.actual, issue.required))
    case 'file_size_bytes':
      return t['admin.advertising.creatives.specIssue.fileSize'](
        params(issue.actual, issue.required),
      )
    case 'is_video':
      return t['admin.advertising.creatives.specIssue.videoNotAllowed']({ placement })
    case 'duration_seconds': {
      if (issue.actual === undefined) {
        return t['admin.advertising.creatives.specIssue.durationMissing']({ placement })
      }
      const below = issue.required !== undefined && Number(issue.actual) < Number(issue.required)
      return below
        ? t['admin.advertising.creatives.specIssue.durationBelow'](
            params(issue.actual, issue.required),
          )
        : t['admin.advertising.creatives.specIssue.durationAbove'](
            params(issue.actual, issue.required),
          )
    }
  }
}

/**
 * Every way the current assets fail every selected placement, each naming
 * the placement and the failing dimension — what the editor renders at
 * upload time, with a resolution for each: remove the image, or drop the
 * placement it fails.
 */
export function specViolations(
  assets: EditorAsset[],
  placements: PlacementSpec[],
): CreativeSpecViolation[] {
  const violations: CreativeSpecViolation[] = []
  const metadata = assets.map((asset) => asset.metadata)
  for (const placement of placements) {
    for (const setIssue of validateAssetSetAgainstSpec(metadata, placement.spec)) {
      violations.push({
        placementKey: placement.key,
        kind: 'set',
        dimension: setIssue.code,
        message: t['admin.advertising.creatives.specIssue.imageRequired']({
          placement: placementLabel(placement.key),
        }),
      })
    }
    assets.forEach((asset, index) => {
      for (const issue of validateAssetAgainstSpec(asset.metadata, placement.spec)) {
        violations.push({
          placementKey: placement.key,
          assetIndex: index,
          kind: 'asset',
          dimension: issue.dimension,
          message: issueMessage(placement.key, issue),
        })
      }
    })
  }
  return violations
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

/**
 * The engine's per-locale text entries as the contract's `CreativeText[]`.
 * The matrix's field names *are* the contract's field names (the backend's
 * validator enforces exactly that parity), so the entries build onto the
 * wire shape without this file spelling a field name the matrix owns.
 * Every field the locale's limits define is sent — the contract's text
 * struct has no optional fields, so a never-typed field goes as an empty
 * string — and locales the matrix gives no limits entry are dropped, since
 * the backend rejects a text whose locale it cannot limit.
 */
export function textsFromEntries(
  entries: { locale: string; values: Record<string, string> }[],
  limitsByLocale: Record<string, Record<string, number>>,
): CreativeText[] {
  return entries
    .map((entry) => {
      const values: Record<string, string> = {}
      for (const field of Object.keys(limitsByLocale[entry.locale] ?? {})) {
        values[field] = entry.values[field] ?? ''
      }
      return { locale: entry.locale, ...values } as CreativeText
    })
    .filter((text) => Object.keys(text).length > 1)
}

/** One create request per selected placement — the contract's creative grain. */
export function buildCreateRequests(
  connectionId: string,
  placements: PlacementSpec[],
  texts: CreativeText[],
  assets: EditorAsset[],
): CreateCreativeRequest[] {
  return placements.map((placement) => ({
    connection_id: connectionId,
    placement: placement.key,
    texts,
    asset_references: assets.map((asset) => asset.id),
    assets: assets.map((asset) => asset.metadata),
  }))
}

/**
 * The connection's platform placements as `PlacementSpec`s, catalog order.
 * A connection without a catalog entry yields nothing — the editor renders
 * no placements rather than guessing.
 */
export function placementsForConnection(
  connection: ConnectionView,
  platforms: PlatformView[],
): PlacementSpec[] {
  const platform = platforms.find((candidate) => candidate.key === connection.platform)
  return (platform?.capability_matrix.creative_placements ?? []).map((placement) => ({
    key: placement.key,
    spec: placement.asset_spec,
  }))
}

/** Builds the measured metadata for a finished upload (see `AssetUploadController`). */
export function metadataFromUpload(state: {
  width: number
  height: number
  fileSizeBytes: number
  contentType: string
}): AdAssetMetadata {
  return assetMetadataFromMeasured(state)
}
