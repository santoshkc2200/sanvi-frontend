<script lang="ts">
import { onMount } from 'svelte'
import type { CourseApiContext } from './context'
import { HlsPlayerController, type HlsPlayerState } from './controllers/hls-player'
import type { MediaAsset } from './model/asset'
import { buildAuthHeaders } from './player/manifestAuth'
import type { VideoPlayerLabels } from './types'

const DEFAULT_LABELS: VideoPlayerLabels = {
  loading: 'Loading video…',
  forbidden: 'You do not have access to this video.',
  playbackUnavailable: 'Video playback is unavailable.',
  quality: 'Video quality',
  qualityAuto: 'Auto',
  qualityLevel: (height) => `${height}p`,
  qualityFallback: (index) => `Quality ${index + 1}`,
  fullscreen: 'Fullscreen',
}

export let runtime: CourseApiContext
export let asset: MediaAsset
export let initialPositionMs: number | undefined = undefined
export let initialSeekMs: number | undefined = undefined
export let onTimeUpdate: ((currentTimeSec: number, durationSec: number) => void) | undefined =
  undefined
export let onPause: ((currentTimeSec: number) => void) | undefined = undefined
export let onEnded: ((currentTimeSec: number) => void) | undefined = undefined
export let className = ''
export let labels: VideoPlayerLabels = DEFAULT_LABELS

let video: HTMLVideoElement
let container: HTMLDivElement
let controller: HlsPlayerController | null = null
let state: HlsPlayerState = {
  status: 'loading',
  errorReason: null,
  isNativeHls: false,
  levels: [],
  currentLevel: -1,
  activeLevel: -1,
}
let captionsUrl: string | null = null
let posterUrl: string | null = null
let appliedPosition = false
let appliedSeek = false

function resolveMediaUrl(path: string): string {
  return path.startsWith('http') ? path : `${runtime.apiBaseUrl}${path}`
}

async function authorizedBlob(path: string, type: string): Promise<string | null> {
  if (!path) return null
  const headers = buildAuthHeaders(await runtime.getToken(), runtime.getTenantId())
  const response = await fetch(resolveMediaUrl(path), {
    headers: headers as Record<string, string>,
  })
  if (!response.ok) return null
  return URL.createObjectURL(new Blob([await response.blob()], { type }))
}

export function seekTo(seconds: number): void {
  if (video) video.currentTime = seconds
}

export function getCurrentTime(): number {
  return video?.currentTime ?? 0
}

onMount(() => {
  controller = new HlsPlayerController(runtime, asset.id)
  const unsubscribe = controller.state.subscribe((next) => (state = next))
  controller.start(video)
  let cancelled = false
  void authorizedBlob(asset.captionsVttUrl, 'text/vtt').then((url) => {
    if (cancelled && url) URL.revokeObjectURL(url)
    else captionsUrl = url
  })
  void authorizedBlob(asset.posterUrl, 'image/*').then((url) => {
    if (cancelled && url) URL.revokeObjectURL(url)
    else posterUrl = url
  })

  return () => {
    cancelled = true
    unsubscribe()
    controller?.destroy()
    controller = null
    if (captionsUrl) URL.revokeObjectURL(captionsUrl)
    if (posterUrl) URL.revokeObjectURL(posterUrl)
  }
})

function handleLoadedMetadata(): void {
  if (!appliedSeek && initialSeekMs !== undefined) {
    appliedSeek = true
    video.currentTime = initialSeekMs / 1000
  } else if (!appliedPosition && initialPositionMs) {
    appliedPosition = true
    video.currentTime = initialPositionMs / 1000
  }
}

function handleTimeUpdate(): void {
  onTimeUpdate?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0)
}

function handleFullscreen(): void {
  if (document.fullscreenElement === container) void document.exitFullscreen()
  else void container.requestFullscreen?.()
}
</script>

<div bind:this={container} class={`sanvi-video-player ${className}`}>
  <video
    bind:this={video}
    controls
    playsinline
    poster={posterUrl ?? undefined}
    on:loadedmetadata={handleLoadedMetadata}
    on:timeupdate={handleTimeUpdate}
    on:pause={() => onPause?.(video.currentTime)}
    on:ended={() => onEnded?.(video.currentTime)}
  >
    {#if captionsUrl}
      <track kind="captions" src={captionsUrl} default={asset.captionsReady} />
    {/if}
  </video>

  {#if state.status === 'loading'}
    <p class="status" aria-live="polite">{labels.loading}</p>
  {:else if state.status === 'error'}
    <p class="status error" role="alert">
      {state.errorReason === 'forbidden' ? labels.forbidden : labels.playbackUnavailable}
    </p>
  {/if}

  <div class="tools">
    {#if state.levels.length > 1}
      <label>
        <span class="sr-only">{labels.quality}</span>
        <select value={state.currentLevel} on:change={(event) => controller?.setLevel(Number(event.currentTarget.value))}>
          <option value={-1}>{labels.qualityAuto}{state.activeLevel >= 0 ? ` (${labels.qualityLevel(state.levels[state.activeLevel]?.height || 0)})` : ''}</option>
          {#each state.levels as level}
            <option value={level.index}>{level.height ? labels.qualityLevel(level.height) : labels.qualityFallback(level.index)}</option>
          {/each}
        </select>
      </label>
    {/if}
    <button type="button" on:click={handleFullscreen}>{labels.fullscreen}</button>
  </div>
</div>

<svelte:window on:keydown={(event) => {
  if (event.key === 'Escape' && document.fullscreenElement === container) void document.exitFullscreen()
}} />

<style>
  .sanvi-video-player { display: grid; gap: .5rem; max-width: 100%; }
  video { width: 100%; background: #111; border-radius: .375rem; }
  .tools { display: flex; justify-content: flex-end; gap: .5rem; }
  .status { margin: 0; font-size: .875rem; }
  .error { color: #b42318; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
