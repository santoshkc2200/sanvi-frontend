/**
 * The media service's namespace-scoped asset API (`/v1/assets`) — the
 * current upload/read surface of `hitox-media-service`. The legacy course
 * functions in `api/media.ts` predate this API; new consumers (advertising
 * creatives, phase 10) build on this module so there is exactly one upload
 * pipeline in the package: mint → PUT/parts → complete, abort on teardown.
 *
 * Scoping: the namespace rides the `X-Namespace-ID` header that
 * `courseApiRequest` sends from the shared context's tenant id. Creation
 * carries an `Idempotency-Key` — the media service refuses a create without
 * one, and a retried mint answers the original asset, never a duplicate.
 */
import { type CourseApiContext, courseApiRequest } from '../context'
import type { CompletedPart, UploadPart } from '../model/asset'
import type { AssetUpload, GenericAsset } from '../model/generic-asset'

interface UploadPartWire {
  part_number: number
  url: string
}

interface UploadWire {
  asset_id: string
  upload_id?: string
  upload_url?: string
  part_size?: number
  part_urls?: UploadPartWire[]
  expires_at: string
}

function toUploadPart(wire: UploadPartWire): UploadPart {
  return { partNumber: wire.part_number, url: wire.url }
}

function toAssetUpload(wire: UploadWire): AssetUpload {
  return {
    assetId: wire.asset_id,
    uploadId: wire.upload_id ?? '',
    partSize: wire.part_size ?? 0,
    partUrls: (wire.part_urls ?? []).map(toUploadPart),
    expiresAt: wire.expires_at,
    uploadUrl: wire.upload_url ?? '',
  }
}

interface AssetWire {
  id: string
  owner_id?: string
  external_ref?: string
  kind: string
  status: GenericAsset['status']
  duration_ms?: number
  width?: number
  height?: number
  progress_percent: number
  error_message?: string
  version: number
  updated_at?: string
}

function toGenericAsset(wire: AssetWire): GenericAsset {
  return {
    id: wire.id,
    ownerId: wire.owner_id ?? '',
    externalRef: wire.external_ref ?? '',
    kind: wire.kind,
    status: wire.status,
    durationMs: wire.duration_ms ?? 0,
    width: wire.width ?? 0,
    height: wire.height ?? 0,
    progressPercent: wire.progress_percent,
    errorMessage: wire.error_message ?? '',
    version: wire.version,
    updatedAt: wire.updated_at ?? '',
  }
}

export interface CreateAssetUploadInput {
  kind: 'image' | 'video'
  contentType: string
  filename: string
  sizeBytes: number
  /** Free-form owner scope for the asset (e.g. the creating surface's id). */
  ownerReference?: string
}

/** `POST /v1/assets` — mints the asset and presigns its upload (PUT or parts). */
export async function createAssetUpload(
  ctx: CourseApiContext,
  input: CreateAssetUploadInput,
  idempotencyKey: string,
): Promise<AssetUpload> {
  const wire = await courseApiRequest<UploadWire>(ctx, '/v1/assets', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      kind: input.kind,
      content_type: input.contentType,
      filename: input.filename,
      size_bytes: input.sizeBytes,
      ...(input.ownerReference ? { owner_id: input.ownerReference } : {}),
    },
  })
  return toAssetUpload(wire)
}

/** `POST /v1/assets/{assetID}/parts` — (re-)presigns part URLs after expiry. */
export async function presignAssetParts(
  ctx: CourseApiContext,
  assetId: string,
  partNumbers: number[],
): Promise<UploadPart[]> {
  const wire = await courseApiRequest<{ part_urls: UploadPartWire[] }>(
    ctx,
    `/v1/assets/${assetId}/parts`,
    { method: 'POST', body: { part_numbers: partNumbers } },
  )
  return wire.part_urls.map(toUploadPart)
}

/** `POST /v1/assets/{assetID}/complete` — commits the upload, enqueues processing. */
export async function completeAssetUpload(
  ctx: CourseApiContext,
  assetId: string,
  parts: CompletedPart[],
): Promise<GenericAsset> {
  const wire = await courseApiRequest<AssetWire>(ctx, `/v1/assets/${assetId}/complete`, {
    method: 'POST',
    body: { parts: parts.map((part) => ({ part_number: part.partNumber, etag: part.etag })) },
  })
  return toGenericAsset(wire)
}

/** `DELETE /v1/assets/{assetID}` — aborts an in-progress upload, schedules cleanup. */
export async function abortAssetUpload(ctx: CourseApiContext, assetId: string): Promise<void> {
  await courseApiRequest<void>(ctx, `/v1/assets/${assetId}`, { method: 'DELETE' })
}

/** `GET /v1/assets/{assetID}` — the asset's current processing state. */
export async function getGenericAsset(
  ctx: CourseApiContext,
  assetId: string,
): Promise<GenericAsset> {
  const wire = await courseApiRequest<AssetWire>(ctx, `/v1/assets/${assetId}`)
  return toGenericAsset(wire)
}

export interface AssetDelivery {
  /** The delivery URL ready for a plain `<img src>` / video element. */
  url: string
  expiresAt: string
}

interface DeliveryWire {
  url?: string
  expires_at?: string
}

/**
 * `POST /v1/assets/{assetID}/delivery` — mints a delivery URL for a ready
 * asset. Advertising placement previews resolve their stored asset
 * references through this; a still-processing asset answers an error the
 * caller renders as "not ready", never as a broken image.
 */
export async function createAssetDelivery(
  ctx: CourseApiContext,
  assetId: string,
): Promise<AssetDelivery> {
  const wire = await courseApiRequest<DeliveryWire>(ctx, `/v1/assets/${assetId}/delivery`, {
    method: 'POST',
  })
  return { url: wire.url ?? '', expiresAt: wire.expires_at ?? '' }
}
