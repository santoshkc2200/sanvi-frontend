<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import PrivacyNoticeBanner from './PrivacyNoticeBanner.svelte'

const { Story } = defineMeta({
  title: 'Privacy/PrivacyNoticeBanner',
  component: PrivacyNoticeBanner,
  tags: ['autodocs'],
})
</script>

<Story
  name="Notice at collection"
  args={{
    open: true,
    title: 'Notice at collection',
    body: 'This store collects the categories below before you browse. Opting out takes one click and never needs an account.',
    categories: ['Contact details', 'Order history', 'Usage data'],
    saleShareNote: 'We share data for cross-context advertising until you opt out — the opt-out is honoured immediately.',
    choicesLabel: 'Your privacy choices',
    choicesHref: '/privacy/choices',
    noticeLabel: 'Privacy notice',
    noticeHref: '/legal/privacy-notice',
    acknowledgeLabel: 'Got it',
    onAcknowledge: () => {},
  }}
>
  {#snippet children()}{/snippet}
</Story>
