<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Hero from './Hero.svelte'

const { Story } = defineMeta({
  title: 'Blocks/Hero',
  component: Hero,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    title: "Crafted for Modern Commerce",
    subtitle: "Deliver extraordinary shopping experiences with lightning-fast themes.",
    primaryCta: { label: "Explore Catalog", href: "/products" },
    secondaryCta: { label: "Learn More", href: "/about" },
    imageUrl: "https://placehold.co/600x400/png",
    imageAlt: "Store showcase",
  }}
/>

<Story
  name="Centered"
  args={{
    title: "Next-Gen Design System",
    subtitle: "Built with token precision.",
    primaryCta: { label: "Get Started", href: "/start" },
    align: "center",
  }}
/>
