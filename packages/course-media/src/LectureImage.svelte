<script lang="ts">
import { onMount, tick } from 'svelte'
import type { CourseApiContext } from './context'
import { resolveImageUrl } from './image/imageUrlCache'
import type { LectureImageLabels } from './types'

const DEFAULT_LABELS: LectureImageLabels = {
  imagePreview: 'Image preview',
  close: 'Close',
}

export let runtime: CourseApiContext
export let url = ''
export let mediaAssetId = ''
export let alt = ''
export let caption = ''
export let layout: 'inline' | 'wide' = 'inline'
export let alignment: 'left' | 'center' | 'right' = 'left'
export let rotation = 0
export let width = 0
export let height = 0
export let labels: LectureImageLabels = DEFAULT_LABELS

let src = mediaAssetId ? '' : url
let failed = false
let lightboxOpen = false
let trigger: HTMLButtonElement
$: maxWidth = layout === 'wide' ? 1100 : 720
$: figureStyle = `max-width: ${maxWidth}px;${width ? ` width: min(${width}px, 100%);` : ''}${alignment === 'center' ? ' margin-inline: auto;' : alignment === 'right' ? ' margin-left: auto;' : ''}`

async function load(force = false): Promise<void> {
  if (!mediaAssetId) {
    src = url
    return
  }
  try {
    src = (await resolveImageUrl(runtime, mediaAssetId, force)).url
    failed = false
  } catch {
    failed = true
  }
}

function closeLightbox(): void {
  lightboxOpen = false
  void tick().then(() => trigger?.focus())
}

onMount(() => {
  void load()
})
</script>

<figure style={figureStyle}>
  {#if failed}
    <p class="fallback">{alt || caption}</p>
  {:else if src}
    <button bind:this={trigger} type="button" aria-label={alt || undefined} on:click={() => lightboxOpen = true}>
      <img
        {src}
        {alt}
        role={alt ? undefined : 'presentation'}
        loading="lazy"
        decoding="async"
        {width}
        {height}
        style={`transform: rotate(${rotation}deg);${width && height ? ` aspect-ratio: ${width} / ${height};` : ''}`}
        on:error={() => void load(true)}
      />
    </button>
  {:else}
    <div class="placeholder" style={width && height ? `aspect-ratio: ${width} / ${height}` : 'aspect-ratio: 16 / 9'}></div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

{#if lightboxOpen && src}
  <div class="lightbox" role="dialog" aria-modal="true" aria-label={alt || labels.imagePreview} tabindex="-1">
    <button class="close" type="button" on:click={closeLightbox}>{labels.close}</button>
    <img {src} {alt} style={`transform: rotate(${rotation}deg)`} />
  </div>
{/if}

<svelte:window on:keydown={(event) => { if (lightboxOpen && event.key === 'Escape') closeLightbox() }} />

<style>
  figure { margin: 0; }
  figure > button { display: block; width: 100%; padding: 0; border: 0; background: transparent; cursor: zoom-in; }
  figure > button > img, .placeholder { display: block; box-sizing: border-box; width: 100%; object-fit: contain; border: 1px solid #cbd5e1; border-radius: .375rem; background: #f1f5f9; }
  figcaption { margin-top: .5rem; color: #475569; font-size: .875rem; font-style: italic; }
  .fallback { padding: 1rem; border: 1px solid #cbd5e1; border-radius: .375rem; color: #475569; }
  .lightbox { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 1.5rem; background: rgb(0 0 0 / .8); }
  .lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .close { position: absolute; top: 1rem; right: 1rem; color: white; background: transparent; border: 1px solid white; border-radius: .25rem; padding: .375rem .625rem; }
</style>
