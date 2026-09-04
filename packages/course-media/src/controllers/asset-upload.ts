import { type Readable, writable } from 'svelte/store'
import { abortAssetUpload, completeAssetUpload, createAssetUpload } from '../api/assets'
import type { CourseApiContext } from '../context'
import { IMAGE_ACCEPTED_TYPES } from './image-upload'
import { measureImage } from '../image/measure'

export type AssetUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; localUrl: string; width: number; height: number }
  | {
      phase: 'ready'
      assetId: string
      localUrl: string
      width: number
      height: number
      /** The file's size and content type, for spec checks on the measured asset. */
      fileSizeBytes: number
      contentType: string
    }
  | { phase: 'failed'; reason: string }

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error'
}

interface MeasureDeps {
  measureImage: typeof measureImage
}

/**
 * The namespace-scoped image uploader (`/v1/assets`) — the advertising
 * creative uploader's engine, sharing this package's one pipeline: accepted
 * types validated up front, dimensions measured client-side before any
 * bytes move, presigned PUT, complete, and abort-on-teardown so a component
 * unmount mid-upload never orphans a half-written object.
 *
 * State is a readable Svelte store, same shape as `ImageUploadState`; the
 * `ready` phase additionally carries the file's size and content type so
 * the consumer can build the asset metadata its spec checks need. The
 * `measure` dep is injectable for tests; production callers omit it.
 */
export class AssetUploadController {
  readonly state: Readable<AssetUploadState>
  private readonly stateStore = writable<AssetUploadState>({ phase: 'idle' })
  private readonly measure: MeasureDeps['measureImage']
  private generation = 0
  private assetId: string | null = null
  private localUrl: string | null = null
  /** Whether the blob URL is still ours to revoke — `takeLocalUrl` transfers it. */
  private localUrlOwned = false
  private controller: AbortController | null = null
  private activeUpload = false

  constructor(
    private readonly ctx: CourseApiContext,
    deps?: Partial<MeasureDeps>,
  ) {
    this.measure = deps?.measureImage ?? measureImage
    this.state = this.stateStore
  }

  start(file: File, ownerReference?: string): void {
    if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) {
      this.stopActiveUpload()
      this.stateStore.set({ phase: 'failed', reason: 'unsupported_file_type' })
      return
    }
    if (file.size === 0) {
      this.stopActiveUpload()
      this.stateStore.set({ phase: 'failed', reason: 'empty_file' })
      return
    }

    this.stopActiveUpload()
    const generation = ++this.generation
    void this.upload(file, ownerReference, generation)
  }

  /**
   * Hands the current local preview URL to the caller and gives up
   * ownership: a consumer that keeps rendering the image after `reset`
   * (the creative editor's previews do) must claim it, or the controller's
   * cleanup would revoke the blob out from under the `<img>`.
   */
  takeLocalUrl(): string | null {
    const url = this.localUrl
    this.localUrlOwned = false
    return url
  }

  reset(): void {
    this.stopActiveUpload()
    this.releaseLocalUrl()
    this.stateStore.set({ phase: 'idle' })
  }

  destroy(): void {
    this.reset()
  }

  private releaseLocalUrl(): void {
    if (this.localUrl && this.localUrlOwned) URL.revokeObjectURL(this.localUrl)
    this.localUrl = null
    this.localUrlOwned = false
  }

  private stopActiveUpload(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
    if (this.activeUpload && this.assetId) {
      void abortAssetUpload(this.ctx, this.assetId).catch(() => {})
    }
    this.assetId = null
    this.activeUpload = false
  }

  private async upload(
    file: File,
    ownerReference: string | undefined,
    generation: number,
  ): Promise<void> {
    try {
      const { url: localUrl, width, height } = await this.measure(file)
      if (generation !== this.generation) {
        URL.revokeObjectURL(localUrl)
        return
      }
      this.releaseLocalUrl()
      this.localUrl = localUrl
      this.localUrlOwned = true
      this.stateStore.set({ phase: 'uploading', localUrl, width, height })

      const upload = await createAssetUpload(
        this.ctx,
        {
          kind: 'image',
          contentType: file.type,
          filename: file.name,
          sizeBytes: file.size,
          ...(ownerReference ? { ownerReference } : {}),
        },
        crypto.randomUUID(),
      )
      if (generation !== this.generation) {
        void abortAssetUpload(this.ctx, upload.assetId).catch(() => {})
        return
      }
      this.assetId = upload.assetId
      this.activeUpload = true
      this.controller = new AbortController()
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
        signal: this.controller.signal,
      })
      if (!response.ok) throw new Error('image_put_failed')
      const asset = await completeAssetUpload(this.ctx, upload.assetId, [])
      if (generation !== this.generation) return
      this.activeUpload = false
      this.controller = null
      this.stateStore.set({
        phase: 'ready',
        assetId: upload.assetId,
        localUrl,
        width: asset.width || width,
        height: asset.height || height,
        fileSizeBytes: file.size,
        contentType: file.type,
      })
    } catch (error) {
      if (generation !== this.generation) return
      const failedAssetId = this.assetId
      this.activeUpload = false
      this.controller = null
      if (failedAssetId) void abortAssetUpload(this.ctx, failedAssetId).catch(() => {})
      this.stateStore.set({ phase: 'failed', reason: reasonFor(error) })
    }
  }
}
