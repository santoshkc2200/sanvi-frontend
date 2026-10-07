<script lang="ts">
import type { Snippet } from 'svelte'
import Cluster from './layout/Cluster.svelte'
import { prefetchOnIntent } from './prefetch'

export interface AppShellNavItem {
  href: string
  label: string
}

interface Props {
  brand: string
  skipLinkLabel: string
  primaryNavLabel: string
  nav: AppShellNavItem[]
  currentPath: string
  onNavigate: (event: MouseEvent, href: string) => void
  /**
   * Warm a nav target's route code on hover/focus (TASK-022). Receives the
   * item's href; the app maps that to its router's lazy loader. The
   * Save-Data / slow-connection guard lives in `prefetchOnIntent`, so every
   * consumer of the shell gets it without re-implementing it.
   */
  prefetch?: (href: string) => void
  /** e.g. the tenant switcher — admin only, `platform-admin` has no per-tenant scope. */
  headerExtra?: Snippet
  userMenu?: Snippet
  breadcrumb?: Snippet
  children: Snippet
}

let {
  brand,
  skipLinkLabel,
  primaryNavLabel,
  nav,
  currentPath,
  onNavigate,
  prefetch,
  headerExtra,
  userMenu,
  breadcrumb,
  children,
}: Props = $props()
</script>

<a href="#main-content" class="sanvi-app-shell__skip-link">{skipLinkLabel}</a>
<div class="sanvi-app-shell">
  <header class="sanvi-app-shell__header">
    <Cluster gap="6" align="center">
      <span class="sanvi-app-shell__brand">{brand}</span>
      <nav aria-label={primaryNavLabel}>
        <Cluster gap="4" as="ul" class="sanvi-app-shell__nav">
          {#each nav as item (item.href)}
            <li>
              <a
                href={item.href}
                aria-current={currentPath === item.href ? 'page' : undefined}
                onclick={(event) => onNavigate(event, item.href)}
                use:prefetchOnIntent={prefetch ? () => prefetch(item.href) : () => {}}
              >
                {item.label}
              </a>
            </li>
          {/each}
        </Cluster>
      </nav>
    </Cluster>
    <Cluster gap="4" align="center">
      {#if headerExtra}
        {@render headerExtra()}
      {/if}
      {#if userMenu}
        {@render userMenu()}
      {/if}
    </Cluster>
  </header>
  {#if breadcrumb}
    <div class="sanvi-app-shell__breadcrumb">
      {@render breadcrumb()}
    </div>
  {/if}
  <main id="main-content" class="sanvi-app-shell__main">
    {@render children()}
  </main>
</div>

<style>
  .sanvi-app-shell__skip-link {
    position: absolute;
    inset-block-start: -100%;
    inset-inline-start: var(--sanvi-spacing-2);
    z-index: var(--sanvi-z-index-modal);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    border-radius: var(--sanvi-radius-md);
  }
  .sanvi-app-shell__skip-link:focus {
    inset-block-start: var(--sanvi-spacing-2);
  }

  .sanvi-app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .sanvi-app-shell__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-app-shell__brand {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  :global(.sanvi-app-shell__nav) {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sanvi-app-shell__header :global(a) {
    color: var(--sanvi-color-text-secondary);
    text-decoration: none;
  }

  .sanvi-app-shell__header :global(a[aria-current='page']) {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-app-shell__breadcrumb {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-6);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-app-shell__main {
    flex: 1;
  }
</style>
