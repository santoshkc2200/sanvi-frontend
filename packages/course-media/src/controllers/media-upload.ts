import { type Readable, writable } from 'svelte/store'
import {
  abortUpload,
  completeUpload,
  createUpload,
  getMediaAsset,
  presignUploadParts,
} from '../api/media'
import { type CourseApiContext, CourseApiError } from '../context'
import type { MediaAsset } from '../model/asset'
import { MultipartUploader, UploadAbortedError } from '../upload/MultipartUploader'

export type MediaUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; sentBytes: number; totalBytes: number; percent: number }
  | { phase: 'completing' }
  | { phase: 'processing'; assetId: string; status: 'queued' | 'processing'; percent: number }
  | { phase: 'ready'; asset: MediaAsset }
  | {
      phase: 'failed'
      status: 'upload_failed' | 'processing_failed' | 'dead'
      reason: string
      canRetry: boolean
    }
  | { phase: 'canceled' }

const MAX_SOURCE_BYTES = 5 * 1024 ** 3
const POLL_DELAYS_MS = [2_000, 5_000, 10_000]
const POLL_TIMEOUT_MS = 2 * 60 * 60 * 1000

function processingStateFor(asset: MediaAsset): MediaUploadState {
  return {
    phase: 'processing',
    assetId: asset.id,
    status: asset.processingStatus === 'queued' ? 'queued' : 'processing',
    percent: asset.progressPercent,
  }
}

function rejectionFor(file: File): string | null {
  if (file.size === 0) return 'empty_file'
  if (file.size > MAX_SOURCE_BYTES) return 'file_too_large'
  if (!file.type.startsWith('video/')) return 'unsupported_file_type'
  return null
}

function reasonFor(error: unknown): { reason: string; canRetry: boolean } {
  if (error instanceof CourseApiError) {
    if (error.code === 'upload_too_large') return { reason: 'file_too_large', canRetry: false }
    if (['invalid_input', 'forbidden', 'not_found'].includes(error.code)) {
      return { reason: error.code, canRetry: false }
    }
    return { reason: error.code, canRetry: true }
  }
  return { reason: error instanceof Error ? error.message : 'unknown_error', canRetry: true }
}

/**
 * Owns an upload lifecycle without a React hook. Subscribe to `state`, call
 * `start`, `retry`, or `cancel`, and call `destroy` when the Svelte owner is
 * destroyed. The controller pauses processing polling while the tab is hidden.
 */
export class MediaUploadController {
  readonly state: Readable<MediaUploadState>
  private readonly stateStore = writable<MediaUploadState>({ phase: 'idle' })
  private currentState: MediaUploadState = { phase: 'idle' }
  private file: File | null = null
  private assetId: string | null = null
  private uploader: MultipartUploader | null = null
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pollAttempt = 0
  private pollDeadline = 0
  private generation = 0
  private activeUpload = false
  private abortOnDestroy = false
  private destroyed = false

  constructor(
    private readonly ctx: CourseApiContext,
    private readonly courseId: string,
  ) {
    this.state = this.stateStore
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  start(file: File): void {
    const rejected = rejectionFor(file)
    this.stopActiveUpload()
    if (rejected) {
      this.setState({ phase: 'failed', status: 'upload_failed', reason: rejected, canRetry: false })
      return
    }
    this.file = file
    const generation = ++this.generation
    void this.upload(file, generation)
  }

  retry(): void {
    if (this.currentState.phase === 'failed' && this.currentState.canRetry && this.file) {
      this.start(this.file)
    }
  }

  cancel(): void {
    if (!['uploading', 'completing', 'processing'].includes(this.currentState.phase)) return
    const assetId = this.assetId
    this.stopActiveUpload()
    this.setState({ phase: 'canceled' })
    if (assetId) {
      void abortUpload(this.ctx, assetId).catch((error: unknown) => {
        this.setState({
          phase: 'failed',
          status: 'upload_failed',
          reason: `cancel_failed:${reasonFor(error).reason}`,
          canRetry: true,
        })
      })
    }
  }

  destroy(): void {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.stopActiveUpload(this.abortOnDestroy)
  }

  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden && this.currentState.phase === 'processing') {
      this.clearPollTimer()
      void this.poll(this.generation)
    }
  }

  private setState(state: MediaUploadState): void {
    this.currentState = state
    this.stateStore.set(state)
  }

  private clearPollTimer(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = null
  }

  private stopActiveUpload(abortServer = true): void {
    this.generation += 1
    this.clearPollTimer()
    this.uploader?.abort()
    this.uploader = null
    if (abortServer && this.activeUpload && this.assetId) {
      void abortUpload(this.ctx, this.assetId).catch(() => {})
    }
    this.assetId = null
    this.activeUpload = false
    this.abortOnDestroy = false
  }

  private async upload(file: File, generation: number): Promise<void> {
    try {
      const upload = await createUpload(this.ctx, {
        courseId: this.courseId,
        kind: 'video',
        contentType: file.type,
        filename: file.name,
        sizeBytes: file.size,
      })
      if (generation !== this.generation) return
      this.assetId = upload.assetId
      this.activeUpload = true
      this.abortOnDestroy = true
      this.uploader = new MultipartUploader({
        file,
        partSize: upload.partSize,
        initialPartUrls: upload.partUrls,
        presignParts: (partNumbers) => presignUploadParts(this.ctx, upload.assetId, partNumbers),
        onProgress: (sentBytes, totalBytes) => {
          if (generation === this.generation) {
            this.setState({
              phase: 'uploading',
              sentBytes,
              totalBytes,
              percent: totalBytes === 0 ? 0 : Math.floor((sentBytes / totalBytes) * 100),
            })
          }
        },
      })
      this.setState({ phase: 'uploading', sentBytes: 0, totalBytes: file.size, percent: 0 })
      const parts = await this.uploader.upload()
      if (generation !== this.generation) return
      this.setState({ phase: 'completing' })
      const asset = await completeUpload(this.ctx, upload.assetId, parts)
      if (generation !== this.generation) return
      this.abortOnDestroy = false
      this.handleCompletedAsset(asset, generation)
    } catch (error) {
      if (generation !== this.generation) return
      this.activeUpload = false
      this.abortOnDestroy = false
      if (error instanceof UploadAbortedError) {
        this.setState({ phase: 'canceled' })
        return
      }
      const failedAssetId = this.assetId
      if (failedAssetId) void abortUpload(this.ctx, failedAssetId).catch(() => {})
      this.setState({ phase: 'failed', status: 'upload_failed', ...reasonFor(error) })
    }
  }

  private handleCompletedAsset(asset: MediaAsset, generation: number): void {
    if (asset.status === 'ready') {
      this.activeUpload = false
      this.setState({ phase: 'ready', asset })
    } else if (asset.status === 'failed') {
      this.activeUpload = false
      this.setState({
        phase: 'failed',
        status: asset.processingStatus === 'dead' ? 'dead' : 'processing_failed',
        reason: asset.errorMessage || 'processing_failed',
        canRetry: true,
      })
    } else if (asset.status === 'canceled') {
      this.activeUpload = false
      this.setState({ phase: 'canceled' })
    } else {
      this.setState(processingStateFor(asset))
      this.startPolling(generation)
    }
  }

  private startPolling(generation: number): void {
    this.pollAttempt = 0
    this.pollDeadline = Date.now() + POLL_TIMEOUT_MS
    this.pollTimer = setTimeout(() => void this.poll(generation), POLL_DELAYS_MS[0])
  }

  private async poll(generation: number): Promise<void> {
    if (this.destroyed || document.hidden || generation !== this.generation || !this.assetId) return
    if (Date.now() >= this.pollDeadline) {
      this.setState({
        phase: 'failed',
        status: 'processing_failed',
        reason: 'still_processing_timeout',
        canRetry: false,
      })
      return
    }
    try {
      const asset = await getMediaAsset(this.ctx, this.assetId)
      if (generation !== this.generation) return
      if (['ready', 'failed', 'canceled'].includes(asset.status)) {
        this.handleCompletedAsset(asset, generation)
        return
      }
      this.setState(processingStateFor(asset))
      this.pollAttempt += 1
      const delay = POLL_DELAYS_MS[this.pollAttempt] ?? POLL_DELAYS_MS.at(-1)!
      this.pollTimer = setTimeout(() => void this.poll(generation), delay)
    } catch (error) {
      if (generation === this.generation) {
        this.setState({ phase: 'failed', status: 'processing_failed', ...reasonFor(error) })
      }
    }
  }
}
