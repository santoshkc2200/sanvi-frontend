<script lang="ts">
import { resolveText, type LocalizedText } from '../utils'

export interface FooterLink {
  label: LocalizedText
  href: string
}

export interface FooterColumn {
  title: LocalizedText
  links: FooterLink[]
}

interface Props {
  brandName?: LocalizedText
  copyrightText?: LocalizedText
  columns?: FooterColumn[]
  bottomLinks?: FooterLink[]
  class?: string
}

let {
  brandName = 'Sanvi',
  copyrightText = '© 2026 Sanvi Inc. All rights reserved.',
  columns = [],
  bottomLinks = [],
  class: className = '',
}: Props = $props()

const brand = $derived(resolveText(brandName))
const copyright = $derived(resolveText(copyrightText))
</script>

<footer class="sanvi-block-footer {className}">
  <div class="sanvi-block-footer__container">
    <div class="sanvi-block-footer__main">
      {#if brand}
        <div class="sanvi-block-footer__brand">
          <span class="sanvi-block-footer__brand-text">{brand}</span>
        </div>
      {/if}

      {#if columns && columns.length > 0}
        <div class="sanvi-block-footer__grid">
          {#each columns as col (resolveText(col.title))}
            <div class="sanvi-block-footer__col">
              <h2 class="sanvi-block-footer__col-title">{resolveText(col.title)}</h2>
              {#if col.links && col.links.length > 0}
                <ul class="sanvi-block-footer__col-list">
                  {#each col.links as link (link.href)}
                    <li>
                      <a href={link.href} class="sanvi-block-footer__link">
                        {resolveText(link.label)}
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="sanvi-block-footer__bottom">
      {#if copyright}
        <p class="sanvi-block-footer__copyright">{copyright}</p>
      {/if}

      {#if bottomLinks && bottomLinks.length > 0}
        <ul class="sanvi-block-footer__bottom-links">
          {#each bottomLinks as link (link.href)}
            <li>
              <a href={link.href} class="sanvi-block-footer__link">
                {resolveText(link.label)}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</footer>

<style>
  .sanvi-block-footer {
    width: 100%;
    background-color: var(--sanvi-color-background-secondary);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-secondary);
  }
  .sanvi-block-footer__container {
    max-width: var(--sanvi-spacing-48);
    margin: var(--sanvi-spacing-0) auto;
    padding: var(--sanvi-spacing-12) var(--sanvi-spacing-6) var(--sanvi-spacing-6);
  }
  .sanvi-block-footer__main {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--sanvi-spacing-8);
    margin-bottom: var(--sanvi-spacing-8);
  }
  .sanvi-block-footer__brand-text {
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-footer__grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-10);
  }
  .sanvi-block-footer__col {
    min-width: var(--sanvi-spacing-32);
  }
  .sanvi-block-footer__col-title {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
    margin: var(--sanvi-spacing-0) var(--sanvi-spacing-0) var(--sanvi-spacing-3);
    text-transform: uppercase;
    
  }
  .sanvi-block-footer__col-list,
  .sanvi-block-footer__bottom-links {
    list-style: none;
    margin: var(--sanvi-spacing-0);
    padding: var(--sanvi-spacing-0);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }
  .sanvi-block-footer__bottom-links {
    flex-direction: row;
    gap: var(--sanvi-spacing-4);
  }
  .sanvi-block-footer__link {
    color: var(--sanvi-color-text-secondary);
    text-decoration: none;
    font-size: var(--sanvi-font-size-sm);
  }
  .sanvi-block-footer__link:hover {
    color: var(--sanvi-color-text-primary);
  }
  .sanvi-block-footer__bottom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding-top: var(--sanvi-spacing-6);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }
  .sanvi-block-footer__copyright {
    margin: var(--sanvi-spacing-0);
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
