<script lang="ts">
import { Cluster } from '@sanvi/ui'
import type { Component } from 'svelte'
import { handleLinkClick, routerState } from './lib/router.svelte'

const routes: Record<string, () => Promise<{ default: Component }>> = {
  '/': () => import('./routes/Tenants.svelte'),
  '/operators': () => import('./routes/Operators.svelte'),
  '/health': () => import('./routes/Health.svelte'),
}
const notFound = () => import('./routes/NotFound.svelte')

const COPY = {
  brand: 'Sanvi Platform Admin',
  skipLink: 'Skip to main content',
  primaryNav: 'Primary',
}

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Tenants' },
  { href: '/operators', label: 'Operators' },
]

let CurrentPage: Component | null = $state(null)

$effect(() => {
  const loader = routes[routerState.pathname] ?? notFound
  let cancelled = false
  loader().then((mod) => {
    if (!cancelled) CurrentPage = mod.default
  })
  return () => {
    cancelled = true
  }
})
</script>

<a href="#main-content" class="app-shell__skip-link">{COPY.skipLink}</a>
<div class="app-shell">
  <header class="app-shell__header">
    <span class="app-shell__brand">{COPY.brand}</span>
    <nav aria-label={COPY.primaryNav}>
      <Cluster gap="4" as="ul" class="app-shell__nav">
        {#each NAV as item (item.href)}
          <li>
            <a
              href={item.href}
              aria-current={routerState.pathname === item.href ? 'page' : undefined}
              onclick={(event) => handleLinkClick(event, item.href)}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </Cluster>
    </nav>
  </header>
  <main id="main-content" class="app-shell__main">
    {#if CurrentPage}
      {@const Page = CurrentPage}
      <Page />
    {/if}
  </main>
</div>

<style>
  .app-shell__skip-link {
    position: absolute;
    inset-block-start: -100%;
    inset-inline-start: var(--sanvi-spacing-2);
    z-index: var(--sanvi-z-index-modal);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    border-radius: var(--sanvi-radius-md);
  }
  .app-shell__skip-link:focus {
    inset-block-start: var(--sanvi-spacing-2);
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-shell__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .app-shell__brand {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  :global(.app-shell__nav) {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .app-shell__header :global(a) {
    color: var(--sanvi-color-text-secondary);
    text-decoration: none;
  }

  .app-shell__header :global(a[aria-current='page']) {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .app-shell__main {
    flex: 1;
  }
</style>
