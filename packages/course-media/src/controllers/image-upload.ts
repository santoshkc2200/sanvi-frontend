import { type Readable, writable } from 'svelte/store'
import { abortUpload, completeUpload, createUpload } from '../api/media'
import type { CourseApiContext } from '../context'
import { measureImage } from '../image/measure'

export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export type ImageUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; localUrl: string; width: number; height: number }
  | { phase: 'ready'; assetId: string; localUrl: string; width: number; height: number }
  | { phase: 'failed'; reason: string }

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error'
}

/**
 * A Svelte-friendly replacement for the React `useImageUpload` hook. Its
 * state is a normal readable Svelte store; call `destroy` from `onDestroy`.
 */
export class ImageUploadController {
  readonly state: Readable<ImageUploadState>
  private readonly stateStore = writable<ImageUploadState>({ phase: 'idle' })
  private generation = 0
  private assetId: string | null = null
  private localUrl: string | null = null
  private controller: AbortController | null = null
  private activeUpload = false

  constructor(
    private readonly ctx: CourseApiContext,
    private readonly courseId: string,
  ) {
    this.state = this.stateStore
  }

  start(file: File): void {
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
    void this.upload(file, generation)
  }

  reset(): void {
    this.stopActiveUpload()
    if (this.localUrl) URL.revokeObjectURL(this.localUrl)
    this.localUrl = null
    this.stateStore.set({ phase: 'idle' })
  }

  destroy(): void {
    this.reset()
  }

  private stopActiveUpload(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
    if (this.activeUpload && this.assetId) void abortUpload(this.ctx, this.assetId).catch(() => {})
    this.assetId = null
    this.activeUpload = false
  }

  private async upload(file: File, generation: number): Promise<void> {
    try {
      const { url: localUrl, width, height } = await measureImage(file)
      if (generation !== this.generation) {
        URL.revokeObjectURL(localUrl)
        return
      }
      if (this.localUrl) URL.revokeObjectURL(this.localUrl)
      this.localUrl = localUrl
      this.stateStore.set({ phase: 'uploading', localUrl, width, height })

      const upload = await createUpload(this.ctx, {
        courseId: this.courseId,
        kind: 'image',
        contentType: file.type,
        filename: file.name,
        sizeBytes: file.size,
      })
      if (generation !== this.generation) {
        void abortUpload(this.ctx, upload.assetId).catch(() => {})
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
      const asset = await completeUpload(this.ctx, upload.assetId, [])
      if (generation !== this.generation) return
      this.activeUpload = false
      this.controller = null
      this.stateStore.set({
        phase: 'ready',
        assetId: upload.assetId,
        localUrl,
        width: asset.width || width,
        height: asset.height || height,
      })
    } catch (error) {
      if (generation !== this.generation) return
      const failedAssetId = this.assetId
      this.activeUpload = false
      this.controller = null
      if (failedAssetId) void abortUpload(this.ctx, failedAssetId).catch(() => {})
      this.stateStore.set({ phase: 'failed', reason: reasonFor(error) })
    }
  }
}
