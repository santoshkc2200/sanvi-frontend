<script lang="ts">
import { resolveText, type LocalizedText } from '../utils'

export interface FeatureItem {
  title: LocalizedText
  description: LocalizedText
  icon?: string
}

interface Props {
  heading?: LocalizedText
  subheading?: LocalizedText
  columns?: number | string
  features?: FeatureItem[]
  class?: string
}

let { heading, subheading, columns = 3, features = [], class: className = '' }: Props = $props()

const headingText = $derived(resolveText(heading))
const subheadingText = $derived(resolveText(subheading))
const colsClass = $derived(`sanvi-block-feature-grid--cols-${columns}`)
</script>

<section class="sanvi-block-feature-grid {colsClass} {className}">
  <div class="sanvi-block-feature-grid__container">
    {#if headingText || subheadingText}
      <div class="sanvi-block-feature-grid__header">
        {#if headingText}
          <h2 class="sanvi-block-feature-grid__heading">{headingText}</h2>
        {/if}
        {#if subheadingText}
          <p class="sanvi-block-feature-grid__subheading">{subheadingText}</p>
        {/if}
      </div>
    {/if}

    {#if features && features.length > 0}
      <div class="sanvi-block-feature-grid__grid">
        {#each features as feature, index (`feature-${index}`)}
          <div class="sanvi-block-feature-grid__card">
            {#if feature.icon}
              <div class="sanvi-block-feature-grid__icon" aria-hidden="true">
                <span class="sanvi-block-feature-grid__icon-text">{feature.icon}</span>
              </div>
            {/if}
            <h3 class="sanvi-block-feature-grid__card-title">{resolveText(feature.title)}</h3>
            <p class="sanvi-block-feature-grid__card-desc">{resolveText(feature.description)}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-feature-grid {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-feature-grid__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-feature-grid__header {
    text-align: center;
    margin-bottom: var(--sanvi-spacing-12);
  }
  .sanvi-block-feature-grid__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
  }
  .sanvi-block-feature-grid__subheading {
    font-size: var(--sanvi-font-size-lg);
    line-height: var(--sanvi-line-height-normal);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-feature-grid__grid {
    display: grid;
    gap: var(--sanvi-spacing-8);
  }
  .sanvi-block-feature-grid--cols-2 .sanvi-block-feature-grid__grid {
    grid-template-columns: repeat(auto-fit, minmax(var(--sanvi-spacing-48), 1fr));
  }
  .sanvi-block-feature-grid--cols-3 .sanvi-block-feature-grid__grid {
    grid-template-columns: repeat(auto-fit, minmax(var(--sanvi-spacing-32), 1fr));
  }
  .sanvi-block-feature-grid--cols-4 .sanvi-block-feature-grid__grid {
    grid-template-columns: repeat(auto-fit, minmax(var(--sanvi-spacing-24), 1fr));
  }
  .sanvi-block-feature-grid__card {
    padding: var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }
  .sanvi-block-feature-grid__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-10);
    height: var(--sanvi-spacing-10);
    border-radius: var(--sanvi-radius-md);
    background-color: var(--sanvi-color-background-tertiary);
    color: var(--sanvi-color-primary-base);
  }
  .sanvi-block-feature-grid__card-title {
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    margin: var(--sanvi-spacing-0);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-feature-grid__card-desc {
    font-size: var(--sanvi-font-size-sm);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
</style>
