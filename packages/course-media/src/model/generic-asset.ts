/**
 * Shapes for the media service's namespace-scoped asset API
 * (`/v1/assets`), camelCase, mapped at the api/ boundary. Distinct from the
 * legacy `MediaAsset` course shapes: an asset here is owner-scoped, not
 * course-scoped — the same storage backend seen through its current API.
 * Upload parts share the legacy `UploadPart`/`CompletedPart` types.
 */
import type { UploadPart } from './asset'

export type GenericAssetStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'canceled'

export interface GenericAsset {
  id: string
  /** Free-form owner scope the creating surface passed at mint time. */
  ownerId: string
  externalRef: string
  kind: string
  status: GenericAssetStatus
  durationMs: number
  width: number
  height: number
  progressPercent: number
  errorMessage: string
  version: number
  updatedAt: string
}

export interface AssetUpload {
  assetId: string
  uploadId: string
  partSize: number
  partUrls: UploadPart[]
  expiresAt: string
  /** Single presigned PUT for small assets — empty when multipart parts are presigned instead. */
  uploadUrl: string
}
