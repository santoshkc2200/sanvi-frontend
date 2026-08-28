<script lang="ts">
import { setSessionContext } from '@sanvi/auth'
import {
  ConsentBanner,
  PrivacyFooterLinks,
  PrivacyNoticeBanner,
  SuspendedTenantNotice,
} from '@sanvi/ui'
import '@sanvi/ui/styles.css'
import { setTenantContext } from '@sanvi/tenant'
import { goto } from '$app/navigation'
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
import type { LayoutData } from './$types'

let { data, children }: { data: LayoutData; children: Snippet } = $props()

// SSR-safe: Svelte context is per-request (per component tree), never a
// module-level singleton — see `@sanvi/tenant`'s `context.ts`. `untrack`
// makes the one-time-read intent explicit: `setContext` only runs during
// component init anyway, so there's nothing to react to even if `data`
// could change later (it can't, within one SSR response).
setTenantContext(untrack(() => data.tenant))
setSessionContext(untrack(() => data.session))

const lockedReason = $derived(
  data.tenant && data.tenant.status !== 'active' ? data.tenant.status : null,
)

const COPY = {
  footerNav: 'Privacy and legal',
  copyright: (name: string) => `Powered by Sanvi for ${name}`,
  choicesLabel: 'Your privacy choices',
  noticeLabel: 'Privacy notice',
  usOptOutLabel: 'Do Not Sell or Share My Personal Information',
  usSensitiveLabel: 'Limit the Use of My Sensitive Personal Information',
  bannerTitle: 'We ask before we track',
  bannerBody:
    'Some features use cookies and similar technology to work well. You decide per purpose, and you can change your mind at any time from “Your privacy choices”.',
  bannerAccept: 'Accept all',
  bannerReject: 'Reject all',
  bannerChoose: 'Choose purposes',
  gpcNotice:
    'We detected a browser privacy signal (Global Privacy Control) and applied it. Accepting all would override it, so we will ask you to confirm first.',
  gpcOverrideTitle: 'Override your browser privacy signal?',
  gpcOverrideBody:
    'Your browser asked us not to sell or share your information. Accepting all overrides that signal — only continue if you mean it.',
  gpcOverrideConfirm: 'Accept anyway',
  gpcOverrideCancel: 'Keep signal',
  overrideDialogClose: 'Close',
  noticeTitle: 'Notice at collection',
  noticeBody:
    'Before you browse: this store collects the categories listed below. Opting out takes one click from any page and never requires an account.',
  noticeAck: 'Got it',
  noticeSaleShare: (sold: boolean) =>
    sold
      ? 'Personal information may be sold or shared for cross-context advertising until you opt out.'
      : 'Personal information is not sold or shared for cross-context advertising.',
}

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
  initConsent({ snapshot: privacy.snapshot, model: privacy.model })
  initGatedAnalytics()
  consentState.version += 1
})

// The store is a singleton, so a derived returning the object itself never
// propagates updates (same reference). Rebuild a small view snapshot from
// `consentState` on every mutation instead — the template renders from this.
const view = $derived.by(() => {
  void consentState.version
  const active = consentState.ready ? getConsent() : null
  if (!active) return null
  return {
    model: active.model,
    gpcApplied: active.gpcApplied,
    showOptIn: active.model === 'opt_in' && active.needsChoice(),
    showNotice: active.model === 'notice_and_opt_out' && active.needsNoticeAck(),
  }
})

const usLinks = $derived(view?.model === 'notice_and_opt_out')

const noticeCategories = $derived(data.privacy?.noticeAtCollection?.categories ?? [])
const saleShareNote = $derived(
  COPY.noticeSaleShare(data.privacy?.noticeAtCollection?.sale_or_share ?? false),
)
</script>

{#if lockedReason}
  <SuspendedTenantNotice reason={lockedReason} />
{:else}
  {@render children()}

  {#if view?.showOptIn || view?.showNotice}
    <!-- The banner floats over the page bottom; this keeps page content
         scrollable past it so no interactive element is buried underneath
         (an EU visitor must be able to browse before deciding). -->
    <div class="sanvi-consent-spacer" aria-hidden="true"></div>
  {/if}

  <footer class="sanvi-footer">
    <div class="sanvi-footer__inner">
      <PrivacyFooterLinks
        label={COPY.footerNav}
        choicesLabel={COPY.choicesLabel}
        choicesHref="/privacy/choices"
        noticeLabel={COPY.noticeLabel}
        noticeHref="/legal/privacy-notice"
        optOutLabel={usLinks ? COPY.usOptOutLabel : undefined}
        optOutHref={usLinks ? '/privacy/opt-out' : undefined}
        sensitiveLabel={usLinks ? COPY.usSensitiveLabel : undefined}
        sensitiveHref={usLinks ? '/privacy/limit-sensitive' : undefined}
      />
      {#if data.tenant}
        <p class="sanvi-footer__copyright">{COPY.copyright(data.tenant.display_name)}</p>
      {/if}
    </div>
  </footer>

  {#if view}
    {#if view.showOptIn}
      <ConsentBanner
        open
        title={COPY.bannerTitle}
        body={COPY.bannerBody}
        purposes={purposes}
        acceptLabel={COPY.bannerAccept}
        rejectLabel={COPY.bannerReject}
        chooseLabel={COPY.bannerChoose}
        gpcNotice={view.gpcApplied ? COPY.gpcNotice : undefined}
        gpcOverrideTitle={COPY.gpcOverrideTitle}
        gpcOverrideBody={COPY.gpcOverrideBody}
        gpcOverrideConfirmLabel={COPY.gpcOverrideConfirm}
        gpcOverrideCancelLabel={COPY.gpcOverrideCancel}
        overrideDialogCloseLabel={COPY.overrideDialogClose}
        onAcceptAll={({ overrideGpc }) => getConsent()?.acceptAll({ overrideGpc })}
        onRejectAll={() => getConsent()?.rejectAll()}
        onChoose={() => goto('/privacy/choices')}
      />
    {:else if view.showNotice}
      <PrivacyNoticeBanner
        open
        title={COPY.noticeTitle}
        body={COPY.noticeBody}
        categories={noticeCategories}
        saleShareNote={saleShareNote}
        choicesLabel={COPY.choicesLabel}
        choicesHref="/privacy/choices"
        noticeLabel={COPY.noticeLabel}
        noticeHref="/legal/privacy-notice"
        acknowledgeLabel={COPY.noticeAck}
        onAcknowledge={() => getConsent()?.acknowledgeNotice()}
      />
    {/if}
  {/if}
{/if}

<style>
  .sanvi-consent-spacer {
    min-height: calc(var(--sanvi-spacing-12) * 2 + var(--sanvi-spacing-8));
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

  .sanvi-footer__copyright {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
