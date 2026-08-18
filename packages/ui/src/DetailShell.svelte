<script lang="ts">
import type { Snippet } from 'svelte'
import Cluster from './layout/Cluster.svelte'

export interface DetailShellTab {
  href: string
  label: string
  /** Renders the tab disabled with `disabledReason` as a tooltip — a later phase's reserved slot, not yet built. */
  disabled?: boolean
  disabledReason?: string
}

interface Props {
  title: string
  subtitle?: string
  statusBadge?: Snippet
  primaryActions?: Snippet
  secondaryActions?: Snippet
  tabs?: DetailShellTab[]
  activeHref?: string
  onNavigate?: (event: MouseEvent, href: string) => void
  meta?: Snippet
  backHref?: string
  backLabel?: string
  onNavigateBack?: (event: MouseEvent) => void
  tabsLabel?: string
  children: Snippet
  class?: string
}

let {
  title,
  subtitle,
  statusBadge,
  primaryActions,
  secondaryActions,
  tabs = [],
  activeHref,
  onNavigate,
  meta,
  backHref,
  backLabel = 'Back',
  onNavigateBack,
  tabsLabel = 'Sections',
  children,
  class: className = '',
}: Props = $props()
</script>

<div class="sanvi-detail-shell {className}">
  <header class="sanvi-detail-shell__header">
    <div class="sanvi-detail-shell__heading">
      {#if backHref}
        <a class="sanvi-detail-shell__back" href={backHref} onclick={(event) => onNavigateBack?.(event)}>
          {backLabel}
        </a>
      {/if}
      <Cluster gap="3" align="center">
        <h1 class="sanvi-detail-shell__title">{title}</h1>
        {#if statusBadge}{@render statusBadge()}{/if}
      </Cluster>
      {#if subtitle}<p class="sanvi-detail-shell__subtitle">{subtitle}</p>{/if}
    </div>
    <Cluster gap="2">
      {#if secondaryActions}{@render secondaryActions()}{/if}
      {#if primaryActions}{@render primaryActions()}{/if}
    </Cluster>
  </header>

  {#if tabs.length > 0}
    <nav aria-label={tabsLabel} class="sanvi-detail-shell__tabs">
      <Cluster gap="4" as="ul" class="sanvi-detail-shell__tab-list">
        {#each tabs as tab (tab.href)}
          <li>
            {#if tab.disabled}
              <span class="sanvi-detail-shell__tab sanvi-detail-shell__tab--disabled" title={tab.disabledReason}>
                {tab.label}
              </span>
            {:else}
              <a
                href={tab.href}
                class="sanvi-detail-shell__tab"
                aria-current={activeHref === tab.href ? 'page' : undefined}
                onclick={(event) => onNavigate?.(event, tab.href)}
              >
                {tab.label}
              </a>
            {/if}
          </li>
        {/each}
      </Cluster>
    </nav>
  {/if}

  <div class="sanvi-detail-shell__body">
    <div class="sanvi-detail-shell__content">
      {@render children()}
    </div>
    {#if meta}
      <aside class="sanvi-detail-shell__meta">
        {@render meta()}
      </aside>
    {/if}
  </div>
</div>

<style>
  .sanvi-detail-shell {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-detail-shell__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-detail-shell__back {
    display: inline-block;
    margin-block-end: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-detail-shell__title {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-detail-shell__subtitle {
    margin: var(--sanvi-spacing-1) 0 0;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-detail-shell__tabs {
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  :global(.sanvi-detail-shell__tab-list) {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sanvi-detail-shell__tab {
    display: inline-block;
    padding-block-end: var(--sanvi-spacing-2);
    color: var(--sanvi-color-text-secondary);
    text-decoration: none;
    border-block-end: var(--sanvi-border-width-thick) solid transparent;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-detail-shell__tab[aria-current='page'] {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
    border-block-end-color: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-detail-shell__tab--disabled {
    color: var(--sanvi-color-text-disabled);
    cursor: not-allowed;
  }

  .sanvi-detail-shell__body {
    display: flex;
    gap: var(--sanvi-spacing-6);
    align-items: flex-start;
  }

  .sanvi-detail-shell__content {
    flex: 1;
    min-width: 0;
  }

  .sanvi-detail-shell__meta {
    flex: 0 0 auto;
    /* Side-panel sizing, not a design-tokens value. */
    width: 18rem; /* sanvi-tokens-ignore */
  }
</style>
