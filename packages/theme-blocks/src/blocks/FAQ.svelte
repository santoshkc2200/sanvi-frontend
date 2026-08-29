<script lang="ts">
import { t } from '@sanvi/i18n'
import { resolveText, type LocalizedText } from '../utils'

export interface FaqItem {
  question: LocalizedText
  answer: LocalizedText
}

interface Props {
  heading?: LocalizedText
  subheading?: LocalizedText
  items?: FaqItem[]
  class?: string
}

let { heading, subheading, items = [], class: className = '' }: Props = $props()

const headingText = $derived(heading ? resolveText(heading) : t['themeBlocks.faq.heading']())
const subheadingText = $derived(resolveText(subheading))
</script>

<section class="sanvi-block-faq {className}">
  <div class="sanvi-block-faq__container">
    {#if headingText || subheadingText}
      <div class="sanvi-block-faq__header">
        {#if headingText}
          <h2 class="sanvi-block-faq__heading">{headingText}</h2>
        {/if}
        {#if subheadingText}
          <p class="sanvi-block-faq__subheading">{subheadingText}</p>
        {/if}
      </div>
    {/if}

    {#if items && items.length > 0}
      <div class="sanvi-block-faq__list">
        {#each items as item, index (`faq-${index}`)}
          <details class="sanvi-block-faq__item">
            <summary class="sanvi-block-faq__question">
              <span>{resolveText(item.question)}</span>
            </summary>
            <div class="sanvi-block-faq__answer">
              <p>{resolveText(item.answer)}</p>
            </div>
          </details>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-faq {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-faq__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-faq__header {
    text-align: center;
    margin-bottom: var(--sanvi-spacing-12);
  }
  .sanvi-block-faq__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
  }
  .sanvi-block-faq__subheading {
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-faq__list {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }
  .sanvi-block-faq__item {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background-color: var(--sanvi-color-background-secondary);
    overflow: hidden;
  }
  .sanvi-block-faq__question {
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-6);
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    cursor: pointer;
    user-select: none;
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-faq__question:hover {
    color: var(--sanvi-color-primary-base);
  }
  .sanvi-block-faq__answer {
    padding: var(--sanvi-spacing-0) var(--sanvi-spacing-6) var(--sanvi-spacing-6);
    font-size: var(--sanvi-font-size-sm);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-secondary);
  }
  .sanvi-block-faq__answer p {
    margin: var(--sanvi-spacing-0);
  }
</style>
