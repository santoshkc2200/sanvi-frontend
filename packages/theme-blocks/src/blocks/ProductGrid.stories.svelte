<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import ProductGrid from './ProductGrid.svelte'

const { Story } = defineMeta({
  title: 'Blocks/ProductGrid',
  component: ProductGrid,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Trending This Week",
    columns: 3,
    products: [
      {
        id: "1",
        title: "Everyday Ceramic Mug",
        price: "$24.00",
        imageUrl: "https://placehold.co/400x400/png",
        imageAlt: "Ceramic Mug",
      },
      {
        id: "2",
        title: "Linen Apron",
        price: "$48.00",
        imageUrl: "https://placehold.co/400x400/png",
        imageAlt: "Linen Apron",
      },
    ],
  }}
/>
