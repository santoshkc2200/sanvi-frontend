<script lang="ts">
import { Image } from '@sanvi/ui'
import { resolveText, type LocalizedText } from '../utils'

export interface BannerCta {
  label: LocalizedText
  href: string
}

interface Props {
  imageUrl?: string
  imageAlt?: LocalizedText
  heading?: LocalizedText
  subheading?: LocalizedText
  cta?: BannerCta
  height?: 'sm' | 'md' | 'lg'
  class?: string
}

let {
  imageUrl = '',
  imageAlt,
  heading,
  subheading,
  cta,
  height = 'md',
  class: className = '',
}: Props = $props()

const headingText = $derived(resolveText(heading))
const subheadingText = $derived(resolveText(subheading))
const altText = $derived(resolveText(imageAlt))
</script>

<section class="sanvi-block-image-banner sanvi-block-image-banner--{height} {className}">
  {#if imageUrl}
    <div class="sanvi-block-image-banner__media">
      <!-- Absolutely positioned and stretched by the container, so these
           dimensions never size the banner — they satisfy the image
           contract (reserve a box, never shift layout) at the 3:1 ratio the
           cover crop enforces. -->
      <Image
        src={imageUrl}
        alt={altText}
        width={1500}
        height={500}
        class="sanvi-block-image-banner__image"
      />
    </div>
  {/if}

  {#if headingText || subheadingText || cta}
    <div class="sanvi-block-image-banner__overlay">
      <div class="sanvi-block-image-banner__content">
        {#if headingText}
          <h2 class="sanvi-block-image-banner__heading">{headingText}</h2>
        {/if}
        {#if subheadingText}
          <p class="sanvi-block-image-banner__subheading">{subheadingText}</p>
        {/if}
        {#if cta}
          <a href={cta.href} class="sanvi-block-image-banner__btn">
            {resolveText(cta.label)}
          </a>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .sanvi-block-image-banner {
    position: relative;
    width: 100%;
    overflow: hidden;
    background-color: var(--sanvi-color-background-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sanvi-block-image-banner--sm {
    min-height: var(--sanvi-spacing-32);
  }
  .sanvi-block-image-banner--md {
    min-height: var(--sanvi-spacing-48);
  }
  .sanvi-block-image-banner--lg {
    min-height: var(--sanvi-spacing-48);
  }
  .sanvi-block-image-banner__media {
    position: absolute;
    inset: var(--sanvi-spacing-0);
    width: 100%;
    height: 100%;
  }
  .sanvi-block-image-banner__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sanvi-block-image-banner__overlay {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: var(--sanvi-spacing-12) var(--sanvi-spacing-6);
    background: var(--sanvi-color-background-primary);
    opacity: 0.92;
    display: flex;
    justify-content: center;
    text-align: center;
  }
  .sanvi-block-image-banner__content {
    max-width: var(--sanvi-spacing-48);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-4);
  }
  .sanvi-block-image-banner__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-image-banner__subheading {
    font-size: var(--sanvi-font-size-lg);
    line-height: var(--sanvi-line-height-normal);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-image-banner__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-md);
    background-color: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    text-decoration: none;
  }
  .sanvi-block-image-banner__btn:hover {
    background-color: var(--sanvi-color-solid-primary-hover);
  }
</style>
