<script lang="ts">
import { resolveText, type LocalizedText } from '../utils'

interface Props {
  heading?: LocalizedText
  body?: LocalizedText
  align?: 'left' | 'center' | 'right'
  class?: string
}

let { heading, body, align = 'left', class: className = '' }: Props = $props()

const headingText = $derived(resolveText(heading))
const bodyText = $derived(resolveText(body))
const paragraphs = $derived(
  bodyText
    ? bodyText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [],
)
</script>

<section class="sanvi-block-rich-text sanvi-block-rich-text--{align} {className}">
  <div class="sanvi-block-rich-text__container">
    {#if headingText}
      <h2 class="sanvi-block-rich-text__heading">{headingText}</h2>
    {/if}
    {#if paragraphs.length > 0}
      <div class="sanvi-block-rich-text__body">
        {#each paragraphs as paragraph, index (`para-${index}`)}
          <p>{paragraph}</p>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-rich-text {
    width: 100%;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-rich-text__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-rich-text--left {
    text-align: left;
  }
  .sanvi-block-rich-text--center {
    text-align: center;
  }
  .sanvi-block-rich-text--right {
    text-align: right;
  }
  .sanvi-block-rich-text__heading {
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-4);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-rich-text__body {
    font-size: var(--sanvi-font-size-md);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-secondary);
  }
  .sanvi-block-rich-text__body p {
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-4);
  }
  .sanvi-block-rich-text__body p:last-child {
    margin-bottom: var(--sanvi-spacing-0);
  }
</style>
