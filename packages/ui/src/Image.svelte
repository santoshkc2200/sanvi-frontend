<script lang="ts">
/**
 * The image pipeline component (TASK-022, step 4).
 *
 * Contract: **explicit dimensions always** — `width`/`height` are required
 * props rendered as attributes, so the browser reserves the box before the
 * bytes arrive and the layout cannot shift (CLS). When the intrinsic size is
 * unknown (tenant uploads), pass the aspect the CSS enforces; the reserved
 * box matches what `object-fit` will show.
 *
 * Loading defaults to `lazy` (below the fold is the common case); the
 * largest above-the-fold element opts into `loading="eager"` +
 * `fetchpriority="high"` — that combination is the LCP lever.
 *
 * `srcset`/`sizes` pass through untouched: same-origin assets and the CDN
 * transform (parked in needs-humans) both express themselves the standard
 * way, and a component that invented its own syntax would be a second
 * format to migrate off.
 */
interface Props {
  src: string
  /** Empty string for decorative images (the component adds role="presentation"). */
  alt: string
  /** Intrinsic width in CSS pixels — required, reserves the layout box. */
  width: number | string
  /** Intrinsic height in CSS pixels — required, reserves the layout box. */
  height: number | string
  srcset?: string
  sizes?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  /** `'high'` for the largest above-the-fold image; undefined leaves the browser's default. */
  fetchpriority?: 'high' | 'low' | 'auto'
  class?: string
}

let {
  src,
  alt,
  width,
  height,
  srcset,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  fetchpriority,
  class: className = '',
}: Props = $props()
</script>

<img
  {src}
  {alt}
  {width}
  {height}
  {srcset}
  {sizes}
  {loading}
  {decoding}
  {fetchpriority}
  role={alt ? undefined : 'presentation'}
  class={className}
/>
