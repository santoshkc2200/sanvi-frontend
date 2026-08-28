<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import PrivacyFooterLinks from './PrivacyFooterLinks.svelte'

const { Story } = defineMeta({
  title: 'Privacy/PrivacyFooterLinks',
  component: PrivacyFooterLinks,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    label: 'Privacy',
    choicesLabel: 'Your privacy choices',
    choicesHref: '/privacy/choices',
    noticeLabel: 'Privacy notice',
    noticeHref: '/legal/privacy-notice',
  }}
>
  {#snippet children()}{/snippet}
</Story>

<Story
  name="US (statutory wordings)"
  args={{
    label: 'Privacy',
    choicesLabel: 'Your privacy choices',
    choicesHref: '/privacy/choices',
    optOutLabel: 'Do Not Sell or Share My Personal Information',
    optOutHref: '/privacy/opt-out',
    sensitiveLabel: 'Limit the Use of My Sensitive Personal Information',
    sensitiveHref: '/privacy/limit-sensitive',
    noticeLabel: 'Privacy notice',
    noticeHref: '/legal/privacy-notice',
  }}
>
  {#snippet children()}{/snippet}
</Story>
