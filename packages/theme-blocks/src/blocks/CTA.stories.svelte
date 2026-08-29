<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import CTA from './CTA.svelte'

const { Story } = defineMeta({
  title: 'Blocks/CTA',
  component: CTA,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Start Your Free 14-Day Trial",
    description: "No credit card required. Cancel anytime with a single click.",
    buttonText: "Create Store",
    buttonHref: "/signup",
    secondaryButtonText: "View Demo",
    secondaryButtonHref: "/demo",
    variant: "primary",
  }}
/>
