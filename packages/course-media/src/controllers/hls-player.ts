import type Hls from 'hls.js'
import { type Readable, writable } from 'svelte/store'
import type { CourseApiContext } from '../context'
import {
  buildAuthHeaders,
  buildNativeHlsSource,
  heightFromVariantUri,
  MediaManifestError,
  needsMediaAuth,
} from '../player/manifestAuth'

export interface HlsLevelInfo {
  index: number
  height: number
  bitrate: number
}

export type HlsPlayerStatus = 'loading' | 'ready' | 'error'
export type HlsPlayerErrorReason = 'forbidden' | 'network' | 'unsupported' | null

export interface HlsPlayerState {
  status: HlsPlayerStatus
  errorReason: HlsPlayerErrorReason
  isNativeHls: boolean
  levels: HlsLevelInfo[]
  /** -1 means adaptive bitrate. */
  currentLevel: number
  /** The rendition currently being rendered. */
  activeLevel: number
}

const INITIAL_STATE: HlsPlayerState = {
  status: 'loading',
  errorReason: null,
  isNativeHls: false,
  levels: [],
  currentLevel: -1,
  activeLevel: -1,
}
const MAX_RECOVERY_ATTEMPTS = 3

function canPlayNativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

/**
 * Framework-neutral HLS controller. It is safe to import during SSR but must
 * be started from Svelte's `onMount`, as it owns a browser video element.
 */
export class HlsPlayerController {
  readonly state: Readable<HlsPlayerState>
  private readonly stateStore = writable<HlsPlayerState>(INITIAL_STATE)
  private generation = 0
  private video: HTMLVideoElement | null = null
  private hls: Hls | null = null
  private revokeNativeSource: (() => void) | null = null
  private setLevelImpl: (index: number) => void = () => {}

  constructor(
    private readonly ctx: CourseApiContext,
    private readonly assetId: string,
  ) {
    this.state = this.stateStore
  }

  start(video: HTMLVideoElement): void {
    this.destroy()
    this.video = video
    const generation = ++this.generation
    this.stateStore.set(INITIAL_STATE)
    void this.setup(video, generation)
  }

  setLevel(index: number): void {
    if (index >= -1) this.setLevelImpl(index)
  }

  retry(): void {
    if (this.video) this.start(this.video)
  }

  destroy(): void {
    this.generation += 1
    this.setLevelImpl = () => {}
    this.hls?.destroy()
    this.hls = null
    this.revokeNativeSource?.()
    this.revokeNativeSource = null
  }

  private setState(patch: Partial<HlsPlayerState>): void {
    this.stateStore.update((current) => ({ ...current, ...patch }))
  }

  private async setup(video: HTMLVideoElement, generation: number): Promise<void> {
    const manifestUrl = new URL(
      `/v1/media/assets/${this.assetId}/playlist.m3u8`,
      this.ctx.apiBaseUrl,
    )
    const manifestUrlString = manifestUrl.toString()
    const isCurrent = () => generation === this.generation
    const refreshAuth = async () =>
      buildAuthHeaders(await this.ctx.getToken(), this.ctx.getTenantId())

    if (canPlayNativeHls(video)) {
      this.setState({ isNativeHls: true })
      let nativeLoadSequence = 0
      const loadNativeLevel = async (selectedLevel: number, preservePlayback: boolean) => {
        const sequence = ++nativeLoadSequence
        const resumeAt = preservePlayback ? video.currentTime : 0
        const resumePlaying = preservePlayback && !video.paused
        const { src, revoke, levels } = await buildNativeHlsSource(
          manifestUrlString,
          await refreshAuth(),
          selectedLevel,
        )
        if (!isCurrent() || sequence !== nativeLoadSequence) {
          revoke()
          return
        }
        this.revokeNativeSource?.()
        this.revokeNativeSource = revoke
        this.setState({
          status: 'ready',
          levels: levels.map((level) => ({
            index: level.index,
            height: level.height,
            bitrate: level.bitrate,
          })),
          currentLevel: selectedLevel,
        })
        video.src = src
        if (preservePlayback) {
          const resume = () => {
            if (!isCurrent() || sequence !== nativeLoadSequence) return
            video.currentTime = resumeAt
            if (resumePlaying) void video.play().catch(() => {})
          }
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resume()
          else video.addEventListener('loadedmetadata', resume, { once: true })
        }
      }
      this.setLevelImpl = (index) => {
        this.setState({ currentLevel: index })
        void loadNativeLevel(index, true).catch((error) => {
          if (!isCurrent()) return
          this.setState({
            status: 'error',
            errorReason:
              error instanceof MediaManifestError && error.status === 403 ? 'forbidden' : 'network',
          })
        })
      }
      try {
        await loadNativeLevel(-1, false)
      } catch (error) {
        if (isCurrent()) {
          this.setState({
            status: 'error',
            errorReason:
              error instanceof MediaManifestError && error.status === 403 ? 'forbidden' : 'network',
          })
        }
      }
      return
    }

    const { default: HlsCtor } = await import('hls.js')
    if (!isCurrent()) return
    if (!HlsCtor.isSupported()) {
      this.setState({ status: 'error', errorReason: 'unsupported' })
      return
    }

    let recoveryAttempts = 0
    let parsed = false
    const auth = { current: await refreshAuth() }
    if (!isCurrent()) return
    const hls = new HlsCtor({
      startLevel: -1,
      capLevelToPlayerSize: true,
      xhrSetup: (xhr, url) => {
        if (!needsMediaAuth(url, this.ctx.apiBaseUrl)) return
        xhr.setRequestHeader('Authorization', auth.current.Authorization)
        if (auth.current['X-Tenant-ID'])
          xhr.setRequestHeader('X-Tenant-ID', auth.current['X-Tenant-ID'])
      },
    })
    this.hls = hls
    this.setLevelImpl = (index) => {
      hls.currentLevel = index
      this.setState({ currentLevel: index })
    }
    hls.on(HlsCtor.Events.MANIFEST_PARSED, (_event, data) => {
      if (!isCurrent()) return
      parsed = true
      recoveryAttempts = 0
      this.setState({
        status: 'ready',
        levels: data.levels.map((level, index) => ({
          index,
          height: (level.height ?? 0) || heightFromVariantUri(level.uri ?? ''),
          bitrate: level.bitrate ?? 0,
        })),
      })
    })
    hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_event, data) => {
      if (isCurrent()) this.setState({ activeLevel: data.level })
    })
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!isCurrent() || !data.fatal) return
      if (!parsed) {
        const status = (data.response as { code?: number } | undefined)?.code
        this.setState({ status: 'error', errorReason: status === 403 ? 'forbidden' : 'network' })
        hls.destroy()
        return
      }
      recoveryAttempts += 1
      if (recoveryAttempts > MAX_RECOVERY_ATTEMPTS) {
        this.setState({ status: 'error', errorReason: 'network' })
        hls.destroy()
        return
      }
      if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
        const resumeAt = video.currentTime
        void refreshAuth().then((fresh) => {
          if (!isCurrent()) return
          auth.current = fresh
          hls.once(HlsCtor.Events.MANIFEST_PARSED, () => {
            video.currentTime = resumeAt
            void video.play().catch(() => {})
          })
          hls.loadSource(manifestUrlString)
        })
      } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError()
      } else {
        this.setState({ status: 'error', errorReason: 'network' })
        hls.destroy()
      }
    })
    hls.attachMedia(video)
    hls.loadSource(manifestUrlString)
  }
}
