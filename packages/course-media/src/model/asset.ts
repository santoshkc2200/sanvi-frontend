/**
 * Domain shapes, camelCase, mapped from the backend's snake_case wire DTOs
 * at the api/ boundary. `sanvi-backend` has no media endpoints yet (no
 * product phase has reached it) — these mirror the shapes this package's
 * upload/playback flows were built against and get reconciled against the
 * real OpenAPI contract in `@sanvi/api-client` once a phase adopts media.
 */

export type MediaAssetStatus =
  | 'uploading'
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'canceled'

export type MediaAssetKind = 'video' | 'thumbnail' | 'image'
export type MediaProcessingStatus = 'queued' | 'running' | 'succeeded' | 'dead' | 'canceled' | ''

/**
 * `progressPercent` is 0 for the entire `uploading` phase — the server has
 * no byte-level visibility into a client's multipart PUTs, it only starts
 * reporting real progress once transcoding begins (`processing`). `version`
 * is a server-side optimistic-concurrency counter with no client-facing
 * write path (no route accepts it back) — informational only, never sent.
 */
export interface MediaAsset {
  id: string
  courseId: string
  kind: MediaAssetKind
  status: MediaAssetStatus
  /** Instructor-only status of the latest background transcode job. */
  processingStatus?: MediaProcessingStatus
  playbackUrl: string
  posterUrl: string
  durationMs: number
  width: number
  height: number
  progressPercent: number
  captionsVttUrl: string
  captionsReady: boolean
  errorMessage: string
  version: number
  updatedAt: string
}

export interface UploadPart {
  partNumber: number
  url: string
}

export interface MediaUpload {
  assetId: string
  uploadId: string
  partSize: number
  partUrls: UploadPart[]
  expiresAt: string
  /** Only set for `kind: 'thumbnail'` — a single presigned PUT, no parts. */
  uploadUrl: string
}

export interface CompletedPart {
  partNumber: number
  etag: string
}

export interface Chapter {
  label: string
  timestampMs: number
}

export interface CaptionInfo {
  language: string
  source: string
  url: string
}

/**
 * `GET /v1/media/assets/{id}/image` — a credential-free, presigned URL ready
 * for a plain `<img src>` (ask A16). `expiresAt` lets the client pre-empt
 * expiry instead of waiting for a broken image / `onError`.
 */
export interface ImageResolve {
  url: string
  width: number
  height: number
  expiresAt: string
}
