<script lang="ts">
import { resolveText, type LocalizedText } from '../utils'

export interface HeroCta {
  label: LocalizedText
  href: string
}

interface Props {
  title?: LocalizedText
  subtitle?: LocalizedText
  primaryCta?: HeroCta
  secondaryCta?: HeroCta
  imageUrl?: string
  imageAlt?: LocalizedText
  align?: 'left' | 'center'
  class?: string
}

let {
  title = 'Welcome to Our Store',
  subtitle,
  primaryCta,
  secondaryCta,
  imageUrl,
  imageAlt = 'Hero banner',
  align = 'left',
  class: className = '',
}: Props = $props()

const titleText = $derived(resolveText(title))
const subtitleText = $derived(resolveText(subtitle))
const altText = $derived(resolveText(imageAlt))
</script>

<section class="sanvi-block-hero sanvi-block-hero--{align} {className}">
  <div class="sanvi-block-hero__container">
    <div class="sanvi-block-hero__content">
      {#if titleText}
        <h1 class="sanvi-block-hero__title">{titleText}</h1>
      {/if}
      {#if subtitleText}
        <p class="sanvi-block-hero__subtitle">{subtitleText}</p>
      {/if}
      {#if primaryCta || secondaryCta}
        <div class="sanvi-block-hero__actions">
          {#if primaryCta}
            <a href={primaryCta.href} class="sanvi-block-hero__btn sanvi-block-hero__btn--primary">
              {resolveText(primaryCta.label)}
            </a>
          {/if}
          {#if secondaryCta}
            <a href={secondaryCta.href} class="sanvi-block-hero__btn sanvi-block-hero__btn--secondary">
              {resolveText(secondaryCta.label)}
            </a>
          {/if}
        </div>
      {/if}
    </div>

    {#if imageUrl}
      <div class="sanvi-block-hero__media">
        <img src={imageUrl} alt={altText} class="sanvi-block-hero__image" />
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-hero {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-hero__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-12);
  }
  .sanvi-block-hero--center .sanvi-block-hero__container {
    flex-direction: column;
    text-align: center;
  }
  .sanvi-block-hero__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-6);
  }
  .sanvi-block-hero--center .sanvi-block-hero__content {
    align-items: center;
  }
  .sanvi-block-hero__title {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-hero__subtitle {
    font-size: var(--sanvi-font-size-lg);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-hero__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sanvi-spacing-4);
  }
  .sanvi-block-hero--center .sanvi-block-hero__actions {
    justify-content: center;
  }
  .sanvi-block-hero__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-md);
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    text-decoration: none;
    transition: background-color 150ms ease;
  }
  .sanvi-block-hero__btn--primary {
    background-color: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }
  .sanvi-block-hero__btn--primary:hover {
    background-color: var(--sanvi-color-solid-primary-hover);
  }
  .sanvi-block-hero__btn--secondary {
    background-color: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }
  .sanvi-block-hero__btn--secondary:hover {
    background-color: var(--sanvi-color-background-tertiary);
  }
  .sanvi-block-hero__media {
    flex: 1;
    display: flex;
    justify-content: center;
  }
  .sanvi-block-hero__image {
    max-width: 100%;
    height: auto;
    border-radius: var(--sanvi-radius-lg);
    object-fit: cover;
  }
</style>
