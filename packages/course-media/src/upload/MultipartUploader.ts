import type { CompletedPart, UploadPart } from '../model/asset'

/**
 * Framework-free multipart uploader (course-ux-phase-9b-media.md, 9b.1) —
 * no React import anywhere in this file so it stays testable without a DOM
 * and reusable if a non-React surface ever needs it. `MultipartUploader`
 * owns only the part queue against S3-compatible storage; committing the
 * upload (`POST .../complete`) and aborting it server-side
 * (`DELETE .../uploads/{id}`) are API calls that belong to the caller
 * (`useMediaUpload`), not to this class.
 */

export class UploadAbortedError extends Error {
  constructor() {
    super('upload_aborted')
    this.name = 'UploadAbortedError'
  }
}

const DEFAULT_MAX_PARALLEL_PARTS = 4
const DEFAULT_MAX_RETRIES_PER_PART = 5
const RETRY_BASE_DELAY_MS = 500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Real network PUT via XHR rather than `fetch` — only `XMLHttpRequest`
 * exposes `upload.onprogress`, which is what makes progress genuinely
 * byte-granular within a single in-flight part rather than jumping only
 * when a whole part finishes.
 */
export function defaultPutPart(
  url: string,
  body: Blob,
  signal: AbortSignal,
  onProgress?: (loadedBytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // The abort event fires once and doesn't replay for late listeners —
    // if the caller already aborted between scheduling this part and this
    // executor running, a listener alone would hang forever.
    if (signal.aborted) {
      reject(new UploadAbortedError())
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // The single most likely misconfiguration: bucket CORS must set
        // Access-Control-Expose-Headers: ETag, or this header reads back
        // empty on a 2xx response (course-ux-phase-9b-media.md, 9b.1).
        const etag = xhr.getResponseHeader('ETag')
        if (!etag) {
          reject(new Error('part_upload_missing_etag'))
          return
        }
        resolve(etag)
      } else {
        reject(new Error(`part_upload_failed:${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('part_upload_network_error'))
    xhr.onabort = () => reject(new UploadAbortedError())
    const onAbort = () => xhr.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    xhr.upload.onloadend = () => signal.removeEventListener('abort', onAbort)
    xhr.send(body)
  })
}

export interface MultipartUploaderOptions {
  file: File
  partSize: number
  initialPartUrls: UploadPart[]
  /** Re-presigns part URLs — used when a cached URL has expired or wasn't included in the initial batch. */
  presignParts: (partNumbers: number[]) => Promise<UploadPart[]>
  /** Injectable for testing; production callers get `defaultPutPart`. */
  putPart?: typeof defaultPutPart
  maxParallelParts?: number
  maxRetriesPerPart?: number
  onProgress?: (sentBytes: number, totalBytes: number) => void
}

/**
 * Slices with `File.slice` and never reads a whole file into memory — a
 * multi-GB `ArrayBuffer` would crash the tab. Bounded parallelism (default
 * 4) uploads several parts at once without making progress jumpy on a
 * typical uplink. Each part retries independently up to 5 times with
 * exponential backoff — a failed part is the common case on mobile and must
 * never fail the whole upload.
 */
export class MultipartUploader {
  private readonly file: File
  private readonly partSize: number
  private readonly presignParts: MultipartUploaderOptions['presignParts']
  private readonly putPart: typeof defaultPutPart
  private readonly maxParallelParts: number
  private readonly maxRetriesPerPart: number
  private readonly onProgress?: MultipartUploaderOptions['onProgress']

  private readonly urlByPart = new Map<number, string>()
  private readonly sentBytesByPart = new Map<number, number>()
  private readonly controller = new AbortController()
  private aborted = false

  constructor(options: MultipartUploaderOptions) {
    this.file = options.file
    this.partSize = options.partSize
    this.presignParts = options.presignParts
    this.putPart = options.putPart ?? defaultPutPart
    this.maxParallelParts = options.maxParallelParts ?? DEFAULT_MAX_PARALLEL_PARTS
    this.maxRetriesPerPart = options.maxRetriesPerPart ?? DEFAULT_MAX_RETRIES_PER_PART
    this.onProgress = options.onProgress
    for (const part of options.initialPartUrls) this.urlByPart.set(part.partNumber, part.url)
  }

  private totalParts(): number {
    return Math.max(1, Math.ceil(this.file.size / this.partSize))
  }

  private reportProgress() {
    if (!this.onProgress) return
    let sent = 0
    for (const bytes of this.sentBytesByPart.values()) sent += bytes
    this.onProgress(sent, this.file.size)
  }

  private sliceFor(partNumber: number): Blob {
    const start = (partNumber - 1) * this.partSize
    const end = Math.min(start + this.partSize, this.file.size)
    return this.file.slice(start, end)
  }

  private async urlFor(partNumber: number): Promise<string> {
    const cached = this.urlByPart.get(partNumber)
    if (cached) return cached
    const [refreshed] = await this.presignParts([partNumber])
    if (!refreshed) throw new Error(`no presigned URL for part ${partNumber}`)
    this.urlByPart.set(partNumber, refreshed.url)
    return refreshed.url
  }

  private async uploadOnePart(partNumber: number): Promise<CompletedPart> {
    const blob = this.sliceFor(partNumber)
    for (let attempt = 1; ; attempt++) {
      if (this.aborted) throw new UploadAbortedError()
      try {
        const url = await this.urlFor(partNumber)
        const etag = await this.putPart(url, blob, this.controller.signal, (loaded) => {
          this.sentBytesByPart.set(partNumber, loaded)
          this.reportProgress()
        })
        this.sentBytesByPart.set(partNumber, blob.size)
        this.reportProgress()
        return { partNumber, etag }
      } catch (error) {
        if (this.aborted || error instanceof UploadAbortedError) throw new UploadAbortedError()
        if (attempt >= this.maxRetriesPerPart) throw error
        this.sentBytesByPart.set(partNumber, 0)
        // The cached URL may itself be the reason this attempt failed (expired) — drop it so the next attempt re-presigns.
        this.urlByPart.delete(partNumber)
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
  }

  /** Uploads every part, bounded to `maxParallelParts` in flight, and returns each part's ETag in part-number order. */
  async upload(): Promise<CompletedPart[]> {
    const total = this.totalParts()
    const results: (CompletedPart | undefined)[] = new Array(total)
    let nextIndex = 0

    const runWorker = async (): Promise<void> => {
      for (;;) {
        if (this.aborted) throw new UploadAbortedError()
        const index = nextIndex++
        if (index >= total) return
        results[index] = await this.uploadOnePart(index + 1)
      }
    }

    const workerCount = Math.min(this.maxParallelParts, total)
    try {
      await Promise.all(Array.from({ length: workerCount }, runWorker))
    } catch (error) {
      // One terminal part failure makes the multipart result unusable. Stop
      // every sibling XHR immediately so they do not keep writing bytes after
      // the hook has already reported failure and scheduled server cleanup.
      this.controller.abort()
      throw error
    }

    return results
      .filter((part): part is CompletedPart => part !== undefined)
      .sort((a, b) => a.partNumber - b.partNumber)
  }

  /** Aborts every in-flight part's XHR. Does not call the server — the caller still owes it a `DELETE .../uploads/{id}`. */
  abort(): void {
    this.aborted = true
    this.controller.abort()
  }
}
