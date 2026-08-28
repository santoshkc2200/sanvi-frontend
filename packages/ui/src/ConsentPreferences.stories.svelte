<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import ConsentPreferences from './ConsentPreferences.svelte'

const { Story } = defineMeta({
  title: 'Privacy/ConsentPreferences',
  component: ConsentPreferences,
  tags: ['autodocs'],
})

const optInRows = [
  {
    key: 'analytics',
    label: 'Product analytics',
    description: 'Helps us understand which pages and features are used.',
    consequence: 'We record page views and feature usage for this store.',
    vendors: 'Vendors: Sanvi platform',
    allowed: false,
    source: 'Default (off until you allow it)',
  },
  {
    key: 'marketing_email',
    label: 'Marketing email',
    description: 'Occasional news about products and offers.',
    consequence: 'We use your email address for campaigns.',
    vendors: 'Vendors: Sanvi platform, Mailjet',
    allowed: false,
    source: 'Default (off until you allow it)',
  },
]

const optOutRows = [
  {
    key: 'sale_or_share',
    label: 'Sale or sharing for cross-context advertising',
    description: 'Sharing data with ad platforms so ads follow you across sites.',
    consequence: 'Opting out stops the sharing at the source, not just in the UI.',
    vendors: 'Vendors: ad platforms from the sub-processor list',
    allowed: true,
    source: 'Default (on until you opt out)',
  },
]
</script>

<Story
  name="Opt-in mode (off by default)"
  args={{ label: 'Privacy preferences', rows: optInRows, onchange: () => {} }}
>
  {#snippet children()}{/snippet}
</Story>

<Story
  name="Notice-and-opt-out mode (on by default, GPC applied)"
  args={{
    label: 'Privacy preferences',
    rows: [
      {
        ...optOutRows[0]!,
        allowed: false,
        locked: true,
        lockedNote: 'Held by the privacy signal your browser sent. Override only if you mean it.',
        source: 'Browser signal',
      },
    ],
    gpcNote: 'We detected a browser privacy signal (Global Privacy Control) and applied it.',
    overrideLabel: 'Override signal',
    onchange: () => {},
    onOverride: () => {},
  }}
>
  {#snippet children()}{/snippet}
</Story>

<Story
  name="With sensitive-data section"
  args={{
    label: 'Privacy preferences',
    rows: optOutRows,
    sensitiveTitle: 'Sensitive personal information',
    sensitiveRows: [
      {
        key: 'sensitive_pi_use',
        label: 'Use of sensitive personal information',
        description: 'Health, precise location and similar sensitive categories this store collects.',
        consequence: 'Limited to what the service strictly requires.',
        allowed: true,
        source: 'Default',
      },
    ],
    onchange: () => {},
  }}
>
  {#snippet children()}{/snippet}
</Story>
