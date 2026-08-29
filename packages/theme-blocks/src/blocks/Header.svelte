<script lang="ts">
import { resolveText, type LocalizedText } from '../utils'

export interface HeaderNavItem {
  label: LocalizedText
  href: string
}

interface Props {
  brandName?: LocalizedText
  brandLogoUrl?: string
  navItems?: HeaderNavItem[]
  sticky?: boolean
  navAriaLabel?: LocalizedText
  class?: string
}

let {
  brandName = 'Sanvi',
  brandLogoUrl,
  navItems = [],
  sticky = false,
  navAriaLabel = 'Main navigation',
  class: className = '',
}: Props = $props()

const brand = $derived(resolveText(brandName))
const navLabel = $derived(resolveText(navAriaLabel))
</script>

<header class="sanvi-block-header {sticky ? "sanvi-block-header--sticky" : ""} {className}">
  <div class="sanvi-block-header__container">
    <div class="sanvi-block-header__brand">
      {#if brandLogoUrl}
        <a href="/" class="sanvi-block-header__logo-link">
          <img src={brandLogoUrl} alt={brand} class="sanvi-block-header__logo" />
        </a>
      {:else if brand}
        <a href="/" class="sanvi-block-header__brand-link">
          <span class="sanvi-block-header__brand-text">{brand}</span>
        </a>
      {/if}
    </div>

    {#if navItems && navItems.length > 0}
      <nav aria-label={navLabel} class="sanvi-block-header__nav">
        <ul class="sanvi-block-header__nav-list">
          {#each navItems as item (item.href)}
            <li class="sanvi-block-header__nav-item">
              <a href={item.href} class="sanvi-block-header__nav-link">
                {resolveText(item.label)}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
  </div>
</header>

<style>
  .sanvi-block-header {
    width: 100%;
    background-color: var(--sanvi-color-background-primary);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-header--sticky {
    position: sticky;
    top: var(--sanvi-spacing-0);
    z-index: var(--sanvi-z-index-dropdown);
  }
  .sanvi-block-header__container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-6);
    margin: var(--sanvi-spacing-0) auto;
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-6);
  }
  .sanvi-block-header__brand {
    display: flex;
    align-items: center;
  }
  .sanvi-block-header__brand-link {
    text-decoration: none;
    color: inherit;
  }
  .sanvi-block-header__brand-text {
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-bold);
    line-height: var(--sanvi-line-height-tight);
  }
  .sanvi-block-header__logo-link {
    display: inline-flex;
  }
  .sanvi-block-header__logo {
    height: var(--sanvi-spacing-8);
    max-width: 100%;
    object-fit: contain;
  }
  .sanvi-block-header__nav-list {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-6);
    list-style: none;
    margin: var(--sanvi-spacing-0);
    padding: var(--sanvi-spacing-0);
  }
  .sanvi-block-header__nav-link {
    color: var(--sanvi-color-text-secondary);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }
  .sanvi-block-header__nav-link:hover {
    color: var(--sanvi-color-primary-base);
  }
</style>
