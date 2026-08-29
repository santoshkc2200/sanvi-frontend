<script lang="ts">
import { t } from '@sanvi/i18n'
import { resolveText, type LocalizedText } from '../utils'

interface Props {
  heading?: LocalizedText
  description?: LocalizedText
  buttonText?: LocalizedText
  buttonHref?: string
  secondaryButtonText?: LocalizedText
  secondaryButtonHref?: string
  variant?: 'primary' | 'subtle' | 'accent'
  class?: string
}

let {
  heading,
  description,
  buttonText,
  buttonHref = '/',
  secondaryButtonText,
  secondaryButtonHref,
  variant = 'primary',
  class: className = '',
}: Props = $props()

const headingText = $derived(heading ? resolveText(heading) : t['themeBlocks.cta.heading']())
const descText = $derived(resolveText(description))
const primaryBtnText = $derived(
  buttonText ? resolveText(buttonText) : t['themeBlocks.cta.buttonText'](),
)
const secondaryBtnText = $derived(resolveText(secondaryButtonText))
</script>

<section class="sanvi-block-cta sanvi-block-cta--{variant} {className}">
  <div class="sanvi-block-cta__container">
    <div class="sanvi-block-cta__content">
      {#if headingText}
        <h2 class="sanvi-block-cta__heading">{headingText}</h2>
      {/if}
      {#if descText}
        <p class="sanvi-block-cta__desc">{descText}</p>
      {/if}
      {#if primaryBtnText || secondaryBtnText}
        <div class="sanvi-block-cta__actions">
          {#if primaryBtnText && buttonHref}
            <a href={buttonHref} class="sanvi-block-cta__btn sanvi-block-cta__btn--primary">
              {primaryBtnText}
            </a>
          {/if}
          {#if secondaryBtnText && secondaryButtonHref}
            <a href={secondaryButtonHref} class="sanvi-block-cta__btn sanvi-block-cta__btn--secondary">
              {secondaryBtnText}
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .sanvi-block-cta {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    text-align: center;
  }
  .sanvi-block-cta--subtle {
    background-color: var(--sanvi-color-background-secondary);
  }
  .sanvi-block-cta--accent {
    background-color: var(--sanvi-color-background-tertiary);
  }
  .sanvi-block-cta__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-cta__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sanvi-spacing-6);
  }
  .sanvi-block-cta__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-cta__desc {
    font-size: var(--sanvi-font-size-lg);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-cta__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-4);
  }
  .sanvi-block-cta__btn {
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
  .sanvi-block-cta__btn--primary {
    background-color: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }
  .sanvi-block-cta__btn--primary:hover {
    background-color: var(--sanvi-color-solid-primary-hover);
  }
  .sanvi-block-cta__btn--secondary {
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }
  .sanvi-block-cta__btn--secondary:hover {
    background-color: var(--sanvi-color-background-secondary);
  }
</style>
