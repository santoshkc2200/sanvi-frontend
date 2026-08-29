<script lang="ts">
import { t } from '@sanvi/i18n'
import { resolveText, type LocalizedText } from '../utils'

export interface ProductItem {
  id: string
  title: LocalizedText
  price: number | string
  currency?: string
  imageUrl?: string
  imageAlt?: LocalizedText
  href?: string
}

interface Props {
  heading?: LocalizedText
  subheading?: LocalizedText
  columns?: number | string
  products?: ProductItem[]
  emptyMessage?: LocalizedText
  class?: string
}

let {
  heading,
  subheading,
  columns = 3,
  products = [],
  emptyMessage,
  class: className = '',
}: Props = $props()

const headingText = $derived(resolveText(heading))
const subheadingText = $derived(resolveText(subheading))
const emptyText = $derived(
  emptyMessage ? resolveText(emptyMessage) : t['themeblocks.productGrid.emptyMessage'](),
)
const colsClass = $derived(`sanvi-block-product-grid--cols-${columns}`)
</script>

<section class="sanvi-block-product-grid {colsClass} {className}">
  <div class="sanvi-block-product-grid__container">
    {#if headingText || subheadingText}
      <div class="sanvi-block-product-grid__header">
        {#if headingText}
          <h2 class="sanvi-block-product-grid__heading">{headingText}</h2>
        {/if}
        {#if subheadingText}
          <p class="sanvi-block-product-grid__subheading">{subheadingText}</p>
        {/if}
      </div>
    {/if}

    {#if products && products.length > 0}
      <div class="sanvi-block-product-grid__grid">
        {#each products as product (product.id)}
          {@const title = resolveText(product.title)}
          {@const alt = resolveText(product.imageAlt) || title}
          {@const link = product.href || `/products/${product.id}`}
          <article class="sanvi-block-product-grid__card">
            <a href={link} class="sanvi-block-product-grid__card-link">
              <div class="sanvi-block-product-grid__image-wrapper">
                {#if product.imageUrl}
                  <img src={product.imageUrl} alt={alt} class="sanvi-block-product-grid__image" />
                {:else}
                  <div class="sanvi-block-product-grid__placeholder" aria-hidden="true"></div>
                {/if}
              </div>
              <div class="sanvi-block-product-grid__card-info">
                <h3 class="sanvi-block-product-grid__product-title">{title}</h3>
                <p class="sanvi-block-product-grid__price">
                  {typeof product.price === "number" ? `$${product.price.toFixed(2)}` : product.price}
                </p>
              </div>
            </a>
          </article>
        {/each}
      </div>
    {:else}
      <div class="sanvi-block-product-grid__empty">
        <p>{emptyText}</p>
      </div>
    {/if}
  </div>
</section>

<style>
  .sanvi-block-product-grid {
    width: 100%;
    padding: var(--sanvi-spacing-16) var(--sanvi-spacing-6);
    background-color: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-product-grid__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
  }
  .sanvi-block-product-grid__header {
    text-align: center;
    margin-bottom: var(--sanvi-spacing-12);
  }
  .sanvi-block-product-grid__heading {
    font-size: var(--sanvi-font-size-3xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
  }
  .sanvi-block-product-grid__subheading {
    font-size: var(--sanvi-font-size-lg);
    color: var(--sanvi-color-text-secondary);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-product-grid__grid {
    display: grid;
    gap: var(--sanvi-spacing-8);
  }
  .sanvi-block-product-grid--cols-2 .sanvi-block-product-grid__grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-48), 1fr));
  }
  .sanvi-block-product-grid--cols-3 .sanvi-block-product-grid__grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-32), 1fr));
  }
  .sanvi-block-product-grid--cols-4 .sanvi-block-product-grid__grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-24), 1fr));
  }
  .sanvi-block-product-grid__card {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    overflow: hidden;
    background-color: var(--sanvi-color-background-primary);
  }
  .sanvi-block-product-grid__card-link {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .sanvi-block-product-grid__image-wrapper {
    aspect-ratio: 1 / 1;
    width: 100%;
    background-color: var(--sanvi-color-background-secondary);
    overflow: hidden;
  }
  .sanvi-block-product-grid__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sanvi-block-product-grid__placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--sanvi-color-background-tertiary);
  }
  .sanvi-block-product-grid__card-info {
    padding: var(--sanvi-spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }
  .sanvi-block-product-grid__product-title {
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    margin: var(--sanvi-spacing-0);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-product-grid__price {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-primary-base);
    margin: var(--sanvi-spacing-0);
  }
  .sanvi-block-product-grid__empty {
    text-align: center;
    padding: var(--sanvi-spacing-12);
    color: var(--sanvi-color-text-secondary);
  }
</style>
