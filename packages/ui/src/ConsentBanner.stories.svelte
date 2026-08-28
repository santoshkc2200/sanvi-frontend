<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import ConsentBanner from './ConsentBanner.svelte'

const { Story } = defineMeta({
  title: 'Privacy/ConsentBanner',
  component: ConsentBanner,
  tags: ['autodocs'],
})
</script>

<Story
  name="Opt-in"
  args={{
    open: true,
    title: 'We ask before we track',
    body: 'Some features use cookies and similar technology. You decide, per purpose — and you can change your mind at any time.',
    purposes: [
      { key: 'analytics', label: 'Product analytics' },
      { key: 'marketing_email', label: 'Marketing email' },
      { key: 'session_replay', label: 'Session replay' },
      { key: 'sale_or_share', label: 'Ads and sharing' },
    ],
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    chooseLabel: 'Choose purposes',
    onAcceptAll: () => {},
    onRejectAll: () => {},
    onChoose: () => {},
  }}
>
  {#snippet children()}{/snippet}
</Story>

<Story
  name="With GPC signal"
  args={{
    open: true,
    title: 'We ask before we track',
    body: 'Some features use cookies and similar technology. You decide, per purpose.',
    purposes: [
      { key: 'analytics', label: 'Product analytics' },
      { key: 'sale_or_share', label: 'Ads and sharing' },
    ],
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    chooseLabel: 'Choose purposes',
    gpcNotice: 'We detected a browser privacy signal and applied it. Accepting all would override it — we will ask first.',
    gpcOverrideTitle: 'Override your browser privacy signal?',
    gpcOverrideBody: 'Your browser asked us not to sell or share your information. Accepting all overrides that signal.',
    gpcOverrideConfirmLabel: 'Accept anyway',
    gpcOverrideCancelLabel: 'Keep signal',
    onAcceptAll: () => {},
    onRejectAll: () => {},
    onChoose: () => {},
  }}
>
  {#snippet children()}{/snippet}
</Story>
