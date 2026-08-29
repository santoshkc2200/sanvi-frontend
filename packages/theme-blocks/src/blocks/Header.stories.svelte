<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Header from './Header.svelte'

const { Story } = defineMeta({
  title: 'Blocks/Header',
  component: Header,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    brandName: "Sanvi Store",
    navItems: [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: "About", href: "/about" },
    ],
  }}
/>

<Story
  name="With Logo"
  args={{
    brandName: "Acme",
    brandLogoUrl: "https://placehold.co/120x40/png",
    navItems: [
      { label: "Shop", href: "/shop" },
      { label: "Deals", href: "/deals" },
    ],
  }}
/>
