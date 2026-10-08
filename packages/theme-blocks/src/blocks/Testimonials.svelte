<script lang="ts">
import { Image } from '@sanvi/ui'
import { resolveText, type LocalizedText } from '../utils'

export interface TestimonialItem {
  quote: LocalizedText
  author: LocalizedText
  role?: LocalizedText
  avatarUrl?: string
}

interface Props {
  heading?: LocalizedText
  subheading?: LocalizedText
  testimonials?: TestimonialItem[]
  class?: string
}

let { heading, subheading, testimonials = [], class: className = '' }: Props = $props()

const headingText = $derived(resolveText(heading))
const subheadingText = $derived(resolveText(subheading))
</script>

<section class="sanvi-block-testimonials {className}">
  <div class="sanvi-block-testimonials__container">
    {#if headingText || subheadingText}
      <div class="sanvi-block-testimonials__header">
        {#if headingText}
          <h2 class="sanvi-block-testimonials__heading">{headingText}</h2>
        {/if}
        {#if subheadingText}
          <p class="sanvi-block-testimonials__subheading">{subheadingText}</p>
        {/if}
      </div>
    {/if}

    {#if testimonials && testimonials.length > 0}
      <div class="sanvi-block-testimonials__grid">
        {#each testimonials as item, index (`test-${index}`)}
          <figure class="sanvi-block-testimonials__card">
            <blockquote class="sanvi-block-testimonials__quote">
              <p>“{resolveText(item.quote)}”</p>
            </blockquote>
            <figcaption class="sanvi-block-testimonials__author-info">
              {#if item.avatarUrl}
                <Image
                  src={item.avatarUrl}
                  alt={resolveText(item.author)}
                  width={96}
                  height={96}
                  class="sanvi-block-testimonials__avatar"
                />
              {/if}
              <div class="sanvi-block-testimonials__author-meta">
                <cite class="sanvi-block-testimonials__author-name">{resolveText(item.author)}</cite>
                {#if item.role}
                  <span class="sanvi-block-testimonials__author-role">{resolveText(item.role)}</span>
                {/if}
              </div>
            </figcaption>
          </figure>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-testimonials {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-testimonials__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-testimonials__header {
    text-align: center;
    margin-bottom: var(--sanvi-spacing-12);
  }
  .sanvi-block-testimonials__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
  }
  .sanvi-block-testimonials__subheading {
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-testimonials__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--sanvi-spacing-32), 1fr));
    gap: var(--sanvi-spacing-8);
  }
  .sanvi-block-testimonials__card {
    margin: var(--sanvi-spacing-0);
    padding: var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--sanvi-spacing-6);
  }
  .sanvi-block-testimonials__quote {
    margin: var(--sanvi-spacing-0);
    font-size: var(--sanvi-font-size-md);
    line-height: var(--sanvi-line-height-relaxed);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-testimonials__quote p {
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-testimonials__author-info {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }
  .sanvi-block-testimonials__avatar {
    width: var(--sanvi-spacing-10);
    height: var(--sanvi-spacing-10);
    border-radius: var(--sanvi-radius-full);
    object-fit: cover;
  }
  .sanvi-block-testimonials__author-meta {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }
  .sanvi-block-testimonials__author-name {
    font-style: normal;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-testimonials__author-role {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
