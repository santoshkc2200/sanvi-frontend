<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Footer from './Footer.svelte'

const { Story } = defineMeta({
  title: 'Blocks/Footer',
  component: Footer,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    brandName: "Sanvi Store",
    copyrightText: "© 2026 Sanvi Inc. All rights reserved.",
    columns: [
      {
        title: "Products",
        links: [
          { label: "Overview", href: "/products" },
          { label: "Pricing", href: "/pricing" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Careers", href: "/careers" },
        ],
      },
    ],
  }}
/>
