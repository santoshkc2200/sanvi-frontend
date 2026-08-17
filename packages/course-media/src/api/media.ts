import { type CourseApiContext, courseApiRequest } from '../context'
import type {
  CaptionInfo,
  Chapter,
  CompletedPart,
  ImageResolve,
  MediaAsset,
  MediaAssetKind,
  MediaUpload,
  UploadPart,
} from '../model/asset'
import { buildAuthHeaders } from '../player/manifestAuth'

interface UploadPartWire {
  part_number: number
  url: string
}

interface UploadWire {
  asset_id: string
  upload_id: string
  upload_url?: string
  part_size?: number
  part_urls?: UploadPartWire[]
  expires_at: string
}

function toUploadPart(wire: UploadPartWire): UploadPart {
  return { partNumber: wire.part_number, url: wire.url }
}

function toMediaUpload(wire: UploadWire): MediaUpload {
  return {
    assetId: wire.asset_id,
    uploadId: wire.upload_id,
    partSize: wire.part_size ?? 0,
    partUrls: (wire.part_urls ?? []).map(toUploadPart),
    expiresAt: wire.expires_at,
    uploadUrl: wire.upload_url ?? '',
  }
}

interface AssetWire {
  id: string
  course_id?: string
  kind: MediaAssetKind
  status: MediaAsset['status']
  processing_status?: NonNullable<MediaAsset['processingStatus']>
  playback_url?: string
  poster_url?: string
  duration_ms?: number
  width?: number
  height?: number
  progress_percent: number
  captions_vtt_url?: string
  captions_ready: boolean
  error_message?: string
  version: number
  updated_at: string
}

function toMediaAsset(wire: AssetWire): MediaAsset {
  return {
    id: wire.id,
    courseId: wire.course_id ?? '',
    kind: wire.kind,
    status: wire.status,
    processingStatus: wire.processing_status ?? '',
    playbackUrl: wire.playback_url ?? '',
    posterUrl: wire.poster_url ?? '',
    durationMs: wire.duration_ms ?? 0,
    width: wire.width ?? 0,
    height: wire.height ?? 0,
    progressPercent: wire.progress_percent,
    captionsVttUrl: wire.captions_vtt_url ?? '',
    captionsReady: wire.captions_ready,
    errorMessage: wire.error_message ?? '',
    version: wire.version,
    updatedAt: wire.updated_at,
  }
}

/** `POST /v1/media/uploads` — mints an asset row and presigns the first batch of part URLs. */
export async function createUpload(
  ctx: CourseApiContext,
  input: {
    courseId: string
    kind: MediaAssetKind
    contentType: string
    filename: string
    sizeBytes: number
  },
): Promise<MediaUpload> {
  const wire = await courseApiRequest<UploadWire>(ctx, '/v1/media/uploads', {
    method: 'POST',
    body: {
      course_id: input.courseId,
      kind: input.kind,
      content_type: input.contentType,
      filename: input.filename,
      size_bytes: input.sizeBytes,
    },
  })
  return toMediaUpload(wire)
}

/** `POST /v1/media/uploads/{assetID}/parts` — (re-)presigns specific part numbers, e.g. after the first batch's URLs expire. */
export async function presignUploadParts(
  ctx: CourseApiContext,
  assetId: string,
  partNumbers: number[],
): Promise<UploadPart[]> {
  const wire = await courseApiRequest<{ part_urls: UploadPartWire[] }>(
    ctx,
    `/v1/media/uploads/${assetId}/parts`,
    { method: 'POST', body: { part_numbers: partNumbers } },
  )
  return wire.part_urls.map(toUploadPart)
}

/** `POST /v1/media/uploads/{assetID}/complete` — commits the multipart upload and enqueues transcoding. */
export async function completeUpload(
  ctx: CourseApiContext,
  assetId: string,
  parts: CompletedPart[],
): Promise<MediaAsset> {
  const wire = await courseApiRequest<AssetWire>(ctx, `/v1/media/uploads/${assetId}/complete`, {
    method: 'POST',
    body: { parts: parts.map((part) => ({ part_number: part.partNumber, etag: part.etag })) },
  })
  return toMediaAsset(wire)
}

/** `DELETE /v1/media/uploads/{assetID}` — aborts an in-progress upload and schedules object cleanup. */
export async function abortUpload(ctx: CourseApiContext, assetId: string): Promise<void> {
  await courseApiRequest<void>(ctx, `/v1/media/uploads/${assetId}`, { method: 'DELETE' })
}

/**
 * `GET /v1/media/assets/{assetID}` — authoring read, gated on `course:update`
 * (or ownership). Used by the instructor editor while polling upload/
 * transcode status. **Never call this for a student** — see `viewAsset`.
 */
export async function getMediaAsset(ctx: CourseApiContext, assetId: string): Promise<MediaAsset> {
  const wire = await courseApiRequest<AssetWire>(ctx, `/v1/media/assets/${assetId}`)
  return toMediaAsset(wire)
}

interface PublicAssetWire {
  id: string
  course_id?: string
  kind: MediaAssetKind
  status: MediaAsset['status']
  playback_url?: string
  poster_url?: string
  duration_ms?: number
  width?: number
  height?: number
  captions_ready: boolean
}

/**
 * `GET /v1/media/assets/{assetID}/view` (ask A18) — the student-safe read:
 * owner, `course:update` holder, actively enrolled student, or free-preview
 * viewer. Unlike `getMediaAsset`, it never 403s an enrolled student, and a
 * still-transcoding asset comes back `200 status: "processing"` instead of
 * an error. **This is what `course-student` must call**, never
 * `getMediaAsset` — that route is authoring-only and 403s every student.
 */
export async function viewAsset(ctx: CourseApiContext, assetId: string): Promise<MediaAsset> {
  const wire = await courseApiRequest<PublicAssetWire>(ctx, `/v1/media/assets/${assetId}/view`)
  return {
    id: wire.id,
    courseId: wire.course_id ?? '',
    kind: wire.kind,
    status: wire.status,
    processingStatus: '',
    playbackUrl: wire.playback_url ?? '',
    posterUrl: wire.poster_url ?? '',
    durationMs: wire.duration_ms ?? 0,
    width: wire.width ?? 0,
    height: wire.height ?? 0,
    progressPercent: wire.status === 'ready' ? 100 : 0,
    captionsVttUrl: '',
    captionsReady: wire.captions_ready,
    errorMessage: '',
    version: 0,
    updatedAt: '',
  }
}

/**
 * `GET /v1/media/assets/{assetID}/image` (ask A16) — a credential-free
 * presigned URL for an `image`-kind asset, playback-gated the same as
 * `viewAsset`. JSON, not a redirect: a native `<img src>` carries no auth
 * headers, so the client makes one authenticated fetch here and then hands
 * the plain URL to `<img src>`, preserving the browser's image cache,
 * `loading="lazy"` and `decoding="async"`.
 */
export async function resolveImage(ctx: CourseApiContext, assetId: string): Promise<ImageResolve> {
  const wire = await courseApiRequest<{
    url: string
    width?: number
    height?: number
    expires_at: string
  }>(ctx, `/v1/media/assets/${assetId}/image`)
  return {
    url: wire.url,
    width: wire.width ?? 0,
    height: wire.height ?? 0,
    expiresAt: wire.expires_at,
  }
}

interface ChapterWire {
  label: string
  timestamp_ms: number
}

function toChapter(wire: ChapterWire): Chapter {
  return { label: wire.label, timestampMs: wire.timestamp_ms }
}

/** `GET /v1/media/assets/{assetID}/chapters` — playback-gated, same as the manifest. */
export async function getChapters(ctx: CourseApiContext, assetId: string): Promise<Chapter[]> {
  const wire = await courseApiRequest<{ chapters: ChapterWire[] }>(
    ctx,
    `/v1/media/assets/${assetId}/chapters`,
  )
  return wire.chapters.map(toChapter)
}

/**
 * `PUT /v1/media/assets/{assetID}/chapters` — replaces the whole list.
 * The server rejects unordered/duplicate/out-of-range timestamps with
 * `invalid_input` (`internal/media/application/service.go`'s
 * `ReplaceChapters`) — callers must sort and dedupe-apart before calling.
 */
export async function putChapters(
  ctx: CourseApiContext,
  assetId: string,
  chapters: Chapter[],
): Promise<Chapter[]> {
  const wire = await courseApiRequest<{ chapters: ChapterWire[] }>(
    ctx,
    `/v1/media/assets/${assetId}/chapters`,
    {
      method: 'PUT',
      body: { chapters: chapters.map((c) => ({ label: c.label, timestamp_ms: c.timestampMs })) },
    },
  )
  return wire.chapters.map(toChapter)
}

/**
 * `POST /v1/media/assets/{assetID}/captions` — upserts a single language.
 * The first language ever uploaded for an asset becomes its default
 * (`captionsVttUrl`/`captionsReady` on `MediaAsset`) — there is no separate
 * "set default" route. Server validates WEBVTT structure and rejects with a
 * generic `400 invalid_caption` (no cue number) — validate client-side first.
 */
export async function putCaption(
  ctx: CourseApiContext,
  assetId: string,
  language: string,
  body: string,
): Promise<CaptionInfo> {
  return courseApiRequest<CaptionInfo>(ctx, `/v1/media/assets/${assetId}/captions`, {
    method: 'POST',
    body: { language, body },
  })
}

/**
 * `GET /v1/media/assets/{assetID}/captions/{language}` — raw `text/vtt`,
 * not JSON, so this bypasses `courseApiRequest` and fetches directly with
 * the same auth headers the manifest fetch uses.
 */
export async function getCaptionText(
  ctx: CourseApiContext,
  assetId: string,
  language: string,
): Promise<string> {
  const token = await ctx.getToken()
  const headers = buildAuthHeaders(token, ctx.getTenantId())
  const response = await fetch(
    `${ctx.apiBaseUrl}/v1/media/assets/${assetId}/captions/${language}`,
    { headers: headers as Record<string, string> },
  )
  if (!response.ok) throw new Error(`caption fetch failed: ${response.status}`)
  return response.text()
}

/** `DELETE /v1/media/assets/{assetID}/captions/{language}` */
export async function deleteCaption(
  ctx: CourseApiContext,
  assetId: string,
  language: string,
): Promise<void> {
  await courseApiRequest<void>(ctx, `/v1/media/assets/${assetId}/captions/${language}`, {
    method: 'DELETE',
  })
}
