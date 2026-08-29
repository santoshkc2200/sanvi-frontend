<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import Testimonials from './Testimonials.svelte'

const { Story } = defineMeta({
  title: 'Blocks/Testimonials',
  component: Testimonials,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Loved by Creators & Merchants",
    testimonials: [
      {
        quote: "Sanvi transformed our store experience completely. Our conversion rate jumped 30%.",
        author: "Emma Watson",
        role: "Founder, Studio Alpha",
      },
      {
        quote: "The zero-flash theme engine is truly cutting edge. Our customers noticed immediately.",
        author: "David Miller",
        role: "Head of Product, Acme Brands",
      },
    ],
  }}
/>
