<script lang="ts">
import { registerAllBlocks } from '@sanvi/theme-blocks'
import { renderLayout, themeStyleTag } from '@sanvi/theme-runtime'
import { setSessionContext } from '@sanvi/auth'
import {
  ConsentBanner,
  PrivacyFooterLinks,
  PrivacyNoticeBanner,
  SuspendedTenantNotice,
} from '@sanvi/ui'
import '@sanvi/ui/styles.css'
import { setTenantContext } from '@sanvi/tenant'
import { createCart, setCartContext } from '$lib/checkout'
import {
  currentLocale,
  initI18n,
  localeHref,
  localeOptions,
  persistLocaleChoice,
  t,
} from '@sanvi/i18n'
import { goto } from '$app/navigation'
import { base } from '$app/paths'
import { page } from '$app/state'
import { untrack } from 'svelte'
import type { Snippet } from 'svelte'
import {
  consentState,
  getConsent,
  initConsent,
  initGatedAnalytics,
  markConsentReady,
} from '$lib/consent.svelte'
import { consentablePurposeCopy } from '$lib/purpose-copy'
import { localePath, setClientDefaultLocale } from '$lib/links'
import { stashLandingClickIds } from '$lib/tracking/click-ids'

registerAllBlocks()
// Preload targets for ja pages (see `<svelte:head>` below): the two
// highest-value unicode-range subsets, vendored in `static/fonts/` from
// `@fontsource-variable/noto-sans-jp` (OFL-1.1 — see static/fonts/README).
// The faces themselves are wired up by the package's unicode-range-split
// CSS, imported through `@sanvi/ui`'s styles.
const kanaSubset = `${base}/fonts/noto-sans-jp-119-wght-normal.woff2`
const kanjiCommonSubset = `${base}/fonts/noto-sans-jp-118-wght-normal.woff2`
import type { LayoutData } from './$types'

let { data, children }: { data: LayoutData; children: Snippet } = $props()

// Before anything renders (this component's init runs before children do,
// on the server and during hydration alike), the runtime must agree with
// the locale the hook negotiated — otherwise the client would render from
// its cookie while the server rendered from the URL, and hydration would
// flash or mismatch. After this, `t`/`fmt` read the same locale everywhere.
// Deliberately the init-time value — see the comment below.
// svelte-ignore state_referenced_locally
initI18n({ locale: data.locale })
// Captured for `localePath`'s event-handler path — `getContext` is
// init-only, but handlers (banner buttons, form redirects) need the
// tenant default too.
setClientDefaultLocale(untrack(() => data.seo.defaultLocale))
// Client-side navigations can move between locales (/privacy → /ja/privacy
// via the switcher): the layout component survives, so its init above
// doesn't re-run — this tracked effect re-seeds the runtime whenever the
// server-negotiated locale changes.
$effect(() => {
  initI18n({ locale: data.locale })
})

// SSR-safe: Svelte context is per-request (per component tree), never a
// module-level singleton — see `@sanvi/tenant`'s `context.ts`. `untrack`
// makes the one-time-read intent explicit: `setContext` only runs during
// component init anyway, so there's nothing to react to even if `data`
// could change later (it can't, within one SSR response).
setTenantContext(untrack(() => data.tenant))
setSessionContext(untrack(() => data.session))
setCartContext(createCart())

const lockedReason = $derived(
  data.tenant && data.tenant.status !== 'active' ? data.tenant.status : null,
)

// Crawlable locale links — the switcher for an SEO-relevant app is real
// `<a hreflang>` anchors, not a `<select>` (invisible to crawlers).
// Preserving path+query is `localeHref`'s whole job.
const localeLinks = $derived(
  localeOptions().map((option) => ({
    ...option,
    href: localeHref(page.url.pathname + page.url.search, option.code),
    current: option.code === currentLocale(),
  })),
)

const purposes = $derived(
  consentablePurposeCopy().map(({ purpose, copy }) => ({ key: purpose, label: copy.label })),
)

// Consent is browser-only (it reads cookies + GPC), so the store is created
// in this effect, after hydration. `consentState` (in `consent.svelte.ts`)
// is the shared reactive signal every privacy surface derives from; the
// store's own mutations bump `consentState.version` from outside any
// tracked effect.
$effect(() => {
  const privacy = data.privacy
  markConsentReady()
  if (!privacy || getConsent()) return
  initConsent({
    snapshot: privacy.snapshot,
    model: privacy.model,
    noticeAtCollectionVersion: privacy.noticeAtCollection?.notice_version ?? null,
  })
  initGatedAnalytics()
  consentState.version += 1
})

// First-party ad click ids (gclid etc.) only ever appear on the URL the
// visitor *landed* on, pages before the confirmation beacon fires — observe
// them here, once per navigation, so the beacon can carry what was seen.
// The stasher overwrites only on a new observation and is a no-op without
// click params.
$effect(() => {
  stashLandingClickIds()
})

// The store is a singleton, so a derived returning the object itself never
// propagates updates (same reference). Rebuild a small view snapshot from
// `consentState` on every mutation instead — the template renders from this.
const view = $derived.by(() => {
  void consentState.version
  const active = consentState.ready ? getConsent() : null
  if (active) {
    return {
      model: active.model,
      gpcApplied: active.gpcApplied,
      showOptIn: active.model === 'opt_in' && active.needsChoice(),
      showNotice: active.model === 'notice_and_opt_out' && active.needsNoticeAck(),
    }
  }
  // Before hydration there is no store, but `initialView` is the same
  // predicate evaluated on the server against the same consent cookie, so
  // the banner is in the SSR HTML rather than appearing a beat later.
  // `gpcApplied` alone is unknowable there — it is a `navigator` flag — so
  // its notice line joins once the store exists.
  const privacy = data.privacy
  if (!privacy) return null
  return {
    model: privacy.model,
    gpcApplied: false,
    showOptIn: privacy.initialView.showOptIn,
    showNotice: privacy.initialView.showNotice,
  }
})

const usLinks = $derived(data.privacy?.model === 'notice_and_opt_out')

const noticeCategories = $derived(data.privacy?.noticeAtCollection?.categories ?? [])
const saleShareNote = $derived(
  data.privacy?.noticeAtCollection?.sale_or_share
    ? t['consent.notice.saleShareSold']()
    : t['consent.notice.saleShareNotSold'](),
)

const pageTitle = $derived(data.tenant?.display_name ?? t['storefront.home.fallbackTitle']())

const layoutTree = $derived(
  renderLayout('storefront.home', {
    theme: data.theme,
  }),
)

const headerSlot = $derived(layoutTree.slots.find((s) => s.name === 'header'))
const footerSlot = $derived(layoutTree.slots.find((s) => s.name === 'footer'))

const LOCALE_TO_SUBSET: Record<string, string> = {
  en: 'latin',
  ja: 'japanese',
}
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html themeStyleTag(data.theme)}
  <link rel="canonical" href="{page.url.origin}{data.seo.canonicalPath}" />
  {#each data.seo.alternates as alternate (alternate.locale)}
    <link rel="alternate" hreflang={alternate.locale} href="{page.url.origin}{alternate.href}" />
  {/each}
  <meta property="og:locale" content={data.seo.ogLocale} />
  {#if data.theme?.fonts}
    {#each data.theme.fonts as font (font.family)}
      {#if !font.subsets || font.subsets.length === 0 || (data.locale && font.subsets.includes(LOCALE_TO_SUBSET[data.locale] ?? data.locale))}
        <link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={font.source} />
      {/if}
    {/each}
  {/if}
  {#if data.locale === 'ja'}
    <!-- Japanese font preloads — only for ja pages, per the phase-06 LCP
         budget: these subsets cover kana + the most frequent kanji; the
         unicode-range-split faces pick up the rest on demand. -->
    <link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={kanaSubset} />
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
      href={kanjiCommonSubset}
    />
  {/if}
</svelte:head>

{#if lockedReason}
  <SuspendedTenantNotice reason={lockedReason} />
{:else}
  {#if headerSlot && headerSlot.blocks.length > 0}
    {#each headerSlot.blocks as block (block.id)}
      <block.component {...block.props} />
    {/each}
  {/if}

  {@render children()}

  {#if view?.showOptIn || view?.showNotice}
    <!-- The banner floats over the page bottom; this keeps page content
         scrollable past it so no interactive element is buried underneath
         (an EU visitor must be able to browse before deciding). -->
    <div class="sanvi-consent-spacer" aria-hidden="true"></div>
  {/if}

  {#if footerSlot && footerSlot.blocks.length > 0}
    {#each footerSlot.blocks as block (block.id)}
      <block.component {...block.props} />
    {/each}
  {:else}
    <footer class="sanvi-footer">
      <div class="sanvi-footer__inner">
        <nav class="sanvi-footer__locales" aria-label={t['storefront.footer.language']()}>
          {#each localeLinks as link (link.code)}
            <a
              href={link.href}
              hreflang={link.code}
              aria-current={link.current ? 'true' : undefined}
              onclick={() => persistLocaleChoice(link.code)}
            >
              {link.label}
            </a>
          {/each}
        </nav>
        <PrivacyFooterLinks
          label={t['storefront.footer.nav']()}
          choicesLabel={t['storefront.footer.choices']()}
          choicesHref={localePath('/privacy/choices')}
          noticeLabel={t['storefront.footer.notice']()}
          noticeHref={localePath('/legal/privacy-notice')}
          optOutLabel={usLinks ? t['storefront.footer.usOptOut']() : undefined}
          optOutHref={usLinks ? localePath('/privacy/opt-out') : undefined}
          sensitiveLabel={usLinks ? t['storefront.footer.usSensitive']() : undefined}
          sensitiveHref={usLinks ? localePath('/privacy/limit-sensitive') : undefined}
        />
        {#if data.tenant}
          <p class="sanvi-footer__copyright">
            {t['storefront.footer.copyright']({ name: data.tenant.display_name })}
          </p>
        {/if}
      </div>
    </footer>
  {/if}

  {#if view}
    {#if view.showOptIn}
      <ConsentBanner
        open
        title={t['consent.banner.title']()}
        body={t['consent.banner.body']()}
        purposes={purposes}
        acceptLabel={t['consent.banner.accept']()}
        rejectLabel={t['consent.banner.reject']()}
        chooseLabel={t['consent.banner.choose']()}
        gpcNotice={view.gpcApplied ? t['consent.banner.gpcNotice']() : undefined}
        gpcOverrideTitle={t['consent.override.title']()}
        gpcOverrideBody={t['consent.override.body']()}
        gpcOverrideConfirmLabel={t['consent.override.confirm']()}
        gpcOverrideCancelLabel={t['consent.override.cancel']()}
        overrideDialogCloseLabel={t['consent.override.close']()}
        onAcceptAll={({ overrideGpc }) => getConsent()?.acceptAll({ overrideGpc })}
        onRejectAll={() => getConsent()?.rejectAll()}
        onChoose={() => goto(localePath('/privacy/choices'))}
      />
    {:else if view.showNotice}
      <PrivacyNoticeBanner
        open
        title={t['consent.notice.title']()}
        body={t['consent.notice.body']()}
        categories={noticeCategories}
        saleShareNote={saleShareNote}
        choicesLabel={t['storefront.footer.choices']()}
        choicesHref={localePath('/privacy/choices')}
        noticeLabel={t['storefront.footer.notice']()}
        noticeHref={localePath('/legal/privacy-notice')}
        acknowledgeLabel={t['consent.notice.ack']()}
        onAcknowledge={() => getConsent()?.acknowledgeNotice()}
      />
    {/if}
  {/if}
{/if}

<style>
  .sanvi-consent-spacer {
    /* Scroll headroom for content under the floating consent banner: the
       banner's stacked mobile height, plus the footer (whose locale nav
       made it taller in phase 06) so end-of-page controls can still scroll
       above the overlay. */
    min-height: calc(var(--sanvi-spacing-12) * 3 + var(--sanvi-spacing-8));
  }

  .sanvi-footer {
    margin-top: var(--sanvi-spacing-8);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-footer__inner {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    max-width: 100%;
    margin-inline: auto;
    padding: var(--sanvi-spacing-4);
  }

  .sanvi-footer__locales {
    display: flex;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-footer__locales a {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-footer__locales a[aria-current='true'] {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-footer__copyright {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
