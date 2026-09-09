import { describe, expect, it } from 'vitest'
import {
  aspectRatioFromDimensions,
  assetMetadataFromMeasured,
  hasImageAsset,
  previewFrameAspectRatio,
  specRequirements,
  validateAssetAgainstSpec,
  validateAssetSetAgainstSpec,
} from '../src/advertising/creative-spec'
import { fixturePlatformByKey } from './fixtures/advertising/index'
import type { AdAssetMetadata, AdAssetSpec } from '../src/forms/types'

/**
 * The client half of the backend's upload-time spec validation (TASK-013).
 * The fixtures carry real matrix specs, so these tests double as parity
 * checks against the same data the backend's validator consumes — same
 * dimensions, same 1 % aspect-ratio tolerance.
 */

const META = fixturePlatformByKey('meta')!

function placementSpec(key: string): AdAssetSpec {
  const placement = META.capability_matrix.creative_placements.find(
    (candidate) => candidate.key === key,
  )
  if (!placement) throw new Error(`fixture is missing the ${key} placement`)
  return placement.asset_spec
}

function metadata(overrides: Partial<AdAssetMetadata> = {}): AdAssetMetadata {
  return {
    aspect_ratio: '1:1',
    file_size_bytes: 1_000_000,
    height_px: 1080,
    is_video: false,
    duration_seconds: null,
    width_px: 1080,
    ...overrides,
  }
}

describe('aspectRatioFromDimensions', () => {
  it('reduces to the smallest whole ratio', () => {
    expect(aspectRatioFromDimensions(1080, 1080)).toBe('1:1')
    expect(aspectRatioFromDimensions(1080, 1920)).toBe('9:16')
    expect(aspectRatioFromDimensions(1000, 1250)).toBe('4:5')
  })

  it('never divides by zero', () => {
    expect(aspectRatioFromDimensions(0, 0)).toBe('1:1')
  })
})

describe('assetMetadataFromMeasured', () => {
  it('marks video by content type and carries the measured dimensions', () => {
    const result = assetMetadataFromMeasured({
      width: 500,
      height: 888,
      fileSizeBytes: 20_000_000,
      contentType: 'video/mp4',
      durationSeconds: 12,
    })
    expect(result.is_video).toBe(true)
    expect(result.aspect_ratio).toBe('125:222')
    expect(result.duration_seconds).toBe(12)
  })
})

describe('validateAssetAgainstSpec', () => {
  it('accepts an asset that meets every dimension of the spec', () => {
    const spec = placementSpec('feed')
    expect(validateAssetAgainstSpec(metadata(), spec)).toEqual([])
  })

  it('names the width dimension when the image is too narrow', () => {
    const spec = placementSpec('feed')
    const issues = validateAssetAgainstSpec(metadata({ width_px: 300, aspect_ratio: '4:5' }), spec)
    expect(issues).toContainEqual({ dimension: 'width_px', actual: 300, required: 600 })
  })

  it('names the height dimension when the image is too short', () => {
    const spec = placementSpec('feed')
    const issues = validateAssetAgainstSpec(metadata({ height_px: 500, aspect_ratio: '4:5' }), spec)
    expect(issues).toContainEqual({ dimension: 'height_px', actual: 500, required: 600 })
  })

  it('rejects an aspect ratio outside the allowed set at the tolerance boundary', () => {
    const spec = placementSpec('stories')
    expect(validateAssetAgainstSpec(metadata({ aspect_ratio: '1:1' }), spec)).toContainEqual({
      dimension: 'aspect_ratio',
      actual: '1:1',
      required: '9:16',
    })
    // 9:15.9 is within 1 % of 9:16 — accepted.
    const nearEnough = validateAssetAgainstSpec(
      metadata({ aspect_ratio: '9:16', width_px: 500, height_px: 892 }),
      spec,
    )
    expect(nearEnough).not.toContainEqual(expect.objectContaining({ dimension: 'aspect_ratio' }))
  })

  it('names the file-size dimension when the file is over the limit', () => {
    const spec = placementSpec('stories')
    const issues = validateAssetAgainstSpec(metadata({ file_size_bytes: 40_000_000 }), spec)
    expect(issues).toContainEqual({
      dimension: 'file_size_bytes',
      actual: 40_000_000,
      required: 31_457_280,
    })
  })

  it('rejects video for a placement that disallows it', () => {
    const spec = {
      ...placementSpec('feed'),
      video_allowed: false,
    }
    const issues = validateAssetAgainstSpec(metadata({ is_video: true }), spec)
    expect(issues).toContainEqual({ dimension: 'is_video', actual: 'video' })
  })

  it('checks video duration bounds only for video assets', () => {
    const spec = placementSpec('stories')
    const tooShort = validateAssetAgainstSpec(
      metadata({ is_video: true, duration_seconds: 0.5 }),
      spec,
    )
    expect(tooShort).toContainEqual({
      dimension: 'duration_seconds',
      actual: 0.5,
      required: 1,
    })
    const tooLong = validateAssetAgainstSpec(
      metadata({ is_video: true, duration_seconds: 121 }),
      spec,
    )
    expect(tooLong).toContainEqual({
      dimension: 'duration_seconds',
      actual: 121,
      required: 120,
    })
    const stillImage = validateAssetAgainstSpec(
      metadata({ is_video: false, aspect_ratio: '9:16', width_px: 500, height_px: 888 }),
      spec,
    )
    expect(stillImage).toEqual([])
  })

  it('demands a readable duration for video when the placement checks one', () => {
    const spec = placementSpec('stories')
    const issues = validateAssetAgainstSpec(
      metadata({ is_video: true, duration_seconds: null }),
      spec,
    )
    expect(issues).toContainEqual({ dimension: 'duration_seconds' })
  })

  it('treats an absent duration the same as an explicit null', () => {
    // API-echoed metadata decodes a missing `duration_seconds` to
    // `undefined`; letting that through would pass the client and be
    // rejected by the backend instead.
    const { duration_seconds: _omitted, ...withoutDuration } = metadata({ is_video: true })
    const issues = validateAssetAgainstSpec(
      withoutDuration as AdAssetMetadata,
      placementSpec('stories'),
    )
    expect(issues).toContainEqual({ dimension: 'duration_seconds' })
  })

  it('accepts a decimal aspect ratio, as the backend parser does', () => {
    // The backend parses both sides of `W:H` as floats — `1.91:1` is a real
    // placement ratio, and an integers-only reader would reject every asset
    // for such a placement while the API accepted it.
    const spec: AdAssetSpec = { ...placementSpec('feed'), aspect_ratios: ['1.91:1'] }
    expect(
      validateAssetAgainstSpec(
        metadata({ aspect_ratio: '1.91:1', width_px: 1910, height_px: 1000 }),
        spec,
      ),
    ).toEqual([])
    const mismatch = validateAssetAgainstSpec(
      metadata({ aspect_ratio: '1:1', width_px: 1080, height_px: 1080 }),
      spec,
    )
    expect(mismatch).toContainEqual({
      dimension: 'aspect_ratio',
      actual: '1:1',
      required: '1.91:1',
    })
  })

  it('still rejects a ratio that is not W:H', () => {
    const spec = placementSpec('feed')
    for (const ratio of ['', '1', '1:', ':1', '1:0', 'a:b', '1e3:1', '-1:1']) {
      expect(validateAssetAgainstSpec(metadata({ aspect_ratio: ratio }), spec)).toContainEqual({
        dimension: 'aspect_ratio',
        actual: ratio,
      })
    }
  })
})

describe('validateAssetSetAgainstSpec', () => {
  it('requires at least one image when the spec says so', () => {
    const spec = placementSpec('feed')
    expect(validateAssetSetAgainstSpec([], spec)).toEqual([{ code: 'image_required' }])
    const videosOnly = metadata({ is_video: true })
    expect(validateAssetSetAgainstSpec([videosOnly], placementSpec('feed'))).toEqual([
      { code: 'image_required' },
    ])
  })

  it('does not require an image where the spec does not', () => {
    expect(
      validateAssetSetAgainstSpec([], { ...placementSpec('feed'), image_required: false }),
    ).toEqual([])
  })

  it('hasImageAsset ignores videos', () => {
    expect(hasImageAsset([metadata({ is_video: true })])).toBe(false)
    expect(hasImageAsset([metadata()])).toBe(true)
  })
})

describe('specRequirements and preview frames', () => {
  it('describes the spec as structured data, in a stable order', () => {
    const lines = specRequirements(placementSpec('feed'))
    expect(lines[0]).toEqual({ kind: 'image_required' })
    expect(lines.some((line) => line.kind === 'aspect_ratios')).toBe(true)
    expect(lines.some((line) => line.kind === 'min_dimensions')).toBe(true)
    expect(lines.some((line) => line.kind === 'max_file_size_bytes')).toBe(true)
  })

  it('omits requirements the spec does not make', () => {
    const lines = specRequirements(placementSpec('feed'))
    expect(lines.some((line) => line.kind === 'video_not_allowed')).toBe(false)
  })

  it('gives the preview frame the spec first ratio as a CSS aspect-ratio', () => {
    expect(previewFrameAspectRatio(placementSpec('stories'))).toBe('9 / 16')
    expect(previewFrameAspectRatio({ ...placementSpec('feed'), aspect_ratios: [] })).toBeUndefined()
  })

  it('keeps a decimal ratio in the preview frame rather than dropping it', () => {
    expect(previewFrameAspectRatio({ ...placementSpec('feed'), aspect_ratios: ['1.91:1'] })).toBe(
      '1.91 / 1',
    )
  })
})
