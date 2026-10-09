<script lang="ts" module>
// TASK-022: holds hydration until the URL's locale catalog shards are in —
// see `$lib/hydration-catalog` (registrar before await; en and the
// prerender server resolve synchronously).
import '$lib/hydration-catalog'
</script>

<script lang="ts">
import '@sanvi/ui/styles.css'
import {
  BASE_LOCALE,
  currentLocale,
  initI18n,
  localeHref,
  localeOptions,
  parseLocalePrefix,
  t,
} from '@sanvi/i18n'
import { page } from '$app/state'
import type { Snippet } from 'svelte'
import { localePath } from '$lib/links'
import { initMarketingTelemetry } from '$lib/telemetry'

// TASK-032: the client bundle's catalog shards, before any child renders —
// the call lives in the module script (TASK-022: it must precede that
// script's catalog await; module-level registration covers the prerender
// server equally).

let { children }: { children: Snippet } = $props()

// Marketing's locale is purely path-derived (no tenant, no cookie): the
// unprefixed pages are `en`, `/{locale}/…` prefixes are that locale's
// canonical URL. Init-time (before children render, server and hydration
// alike) plus a tracking effect for client-side navigations — this layout
// isn't re-inited when only the page changes, but the effect re-seeds the
// runtime whenever the path's locale does.
initI18n({ locale: parseLocalePrefix(page.url.pathname)?.locale ?? BASE_LOCALE })
$effect(() => {
  initI18n({ locale: parseLocalePrefix(page.url.pathname)?.locale ?? BASE_LOCALE })
})

// RUM collection — wired but disabled (see `$lib/telemetry` for why).
$effect(() => {
  initMarketingTelemetry()
})

// Crawlable locale links in a real nav — the prerender crawler discovers
// every `/{locale}` variant through these anchors. Path only: prerender
// forbids `url.search`, and marketing pages take no query parameters.
const localeLinks = $derived(
  localeOptions().map((option) => ({
    ...option,
    href: localeHref(page.url.pathname, option.code),
    current: option.code === currentLocale(),
  })),
)
</script>

<svelte:head>
  <link rel="canonical" href="{page.url.origin}{page.url.pathname}" />
  {#each localeLinks as link (link.code)}
    <link rel="alternate" hreflang={link.code} href="{page.url.origin}{link.href}" />
  {/each}
  <link rel="alternate" hreflang="x-default" href="{page.url.origin}{page.url.pathname}" />
</svelte:head>

{@render children()}

<footer class="sanvi-marketing-footer">
  <nav aria-label={t['marketing.footer.language']()}>
    <a href={localePath('/status')}>{t['marketing.footer.status']()}</a>
    {#each localeLinks as link (link.code)}
      <a href={link.href} hreflang={link.code} aria-current={link.current ? 'true' : undefined}>
        {link.label}
      </a>
    {/each}
  </nav>
</footer>

<style>
  /* The app shell wrapper (app.html) — global, not scoped: the element
     lives outside Svelte's component tree. Replaces the old inline
     style="display: contents" attribute, which the TASK-024 tightened CSP
     (no unsafe-inline) would block as a style-src-attr violation. */
  :global(.sanvi-app-body) {
    display: contents;
  }

  .sanvi-marketing-footer {
    margin-top: var(--sanvi-spacing-8);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-6);
    display: flex;
    justify-content: flex-end;
  }

  .sanvi-marketing-footer nav {
    display: flex;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-marketing-footer a {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-marketing-footer a[aria-current='true'] {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
  }
</style>
