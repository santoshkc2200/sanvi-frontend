<script lang="ts">
import { previewFrameAspectRatio, previewFrameDimensions } from './creative-spec'
import type { AdAssetSpec } from '../forms/types'

/**
 * One placement's preview frame (phase 10, TASK-013): the actual assets and
 * copy composed inside the placement's aspect ratio, themed through the
 * phase-07 design tokens like every other surface. The frame's shape comes
 * from the spec's allowed ratios — matrix data, never a platform name — so
 * a new network's placements preview with zero code change.
 *
 * The copy block carries the content `lang` so CJK typography (phase 06)
 * applies where it should: a headline that fits in English and overflows in
 * Japanese is a bug this frame is built to catch, which is why overflow
 * clips instead of growing the frame.
 */
interface Labels {
  /** Accessible name of the whole preview figure. */
  frameLabel?: string
  /** Shown in the image area when no asset has been uploaded yet. */
  noImageLabel?: string
  /** Shown for copy that has not been written yet. */
  emptyCopyLabel?: string
}

interface Props {
  /** The raw placement key (matrix data); `placementLabel` is its display name. */
  placementKey: string
  placementLabel: string
  spec: AdAssetSpec
  /**
   * The copy lines in field order — the matrix's text fields as the caller
   * resolves them. The first line renders as the visual lead (the headline
   * slot), the rest as supporting copy.
   */
  copyLines?: string[]
  imageUrl?: string
  imageAlt?: string
  /** Content locale of the copy — drives the preview text's `lang`. */
  locale?: string
  labels?: Labels
  class?: string
}

let {
  placementKey,
  placementLabel,
  spec,
  copyLines = [],
  imageUrl = undefined,
  imageAlt = '',
  locale = undefined,
  labels = {},
  class: className = '',
}: Props = $props()

const COPY = {
  frameLabel: 'Preview',
  noImageLabel: 'No image yet',
  emptyCopyLabel: '—',
}

const frameAspectRatio = $derived(previewFrameAspectRatio(spec))
const frameDimensions = $derived(previewFrameDimensions(spec) ?? { width: 100, height: 100 })
const display = $derived({
  frameLabel: labels.frameLabel ?? `${placementLabel} ${COPY.frameLabel}`,
  noImageLabel: labels.noImageLabel ?? COPY.noImageLabel,
  emptyCopyLabel: labels.emptyCopyLabel ?? COPY.emptyCopyLabel,
})
const lines = $derived(copyLines.filter((line) => line.trim() !== ''))
</script>

<figure class="sanvi-ad-preview {className}" aria-label={display.frameLabel} data-placement={placementKey}>
  <div class="sanvi-ad-preview__frame" style:aspect-ratio={frameAspectRatio}>
    {#if imageUrl}
      <img
        class="sanvi-ad-preview__image"
        src={imageUrl}
        alt={imageAlt}
        width={frameDimensions.width}
        height={frameDimensions.height}
        loading="lazy"
        decoding="async"
      />
    {:else}
      <div class="sanvi-ad-preview__no-image">{display.noImageLabel}</div>
    {/if}
  </div>
  <div class="sanvi-ad-preview__copy" lang={locale}>
    {#if lines.length === 0}
      <p class="sanvi-ad-preview__body">{display.emptyCopyLabel}</p>
    {:else}
      {#each lines as line, index (index)}
        <p class={index === 0 ? 'sanvi-ad-preview__lead' : 'sanvi-ad-preview__body'}>{line}</p>
      {/each}
    {/if}
  </div>
  <figcaption class="sanvi-ad-preview__caption">{placementLabel}</figcaption>
</figure>

<style>
  .sanvi-ad-preview {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    width: 100%;
  }

  .sanvi-ad-preview__frame {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-ad-preview__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sanvi-ad-preview__no-image {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    padding: var(--sanvi-spacing-3);
    text-align: center;
  }

  .sanvi-ad-preview__copy {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    overflow: hidden;
  }

  /* CJK-safe: break anywhere rather than overflow the frame, never stretch
     the frame to fit copy that a real placement would clip. */
  .sanvi-ad-preview__copy p {
    margin: 0;
    overflow-wrap: anywhere;
    line-break: strict;
    hyphens: none;
  }

  .sanvi-ad-preview__lead {
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-preview__body {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-preview__caption {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
