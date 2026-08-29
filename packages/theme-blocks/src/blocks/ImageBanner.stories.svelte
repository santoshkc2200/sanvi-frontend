<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import ImageBanner from './ImageBanner.svelte'

const { Story } = defineMeta({
  title: 'Blocks/ImageBanner',
  component: ImageBanner,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    imageUrl: "https://placehold.co/1200x400/png",
    imageAlt: "Spring showcase",
    heading: "Spring Essentials",
    subheading: "Fresh arrivals for the new season.",
    cta: { label: "Explore Collection", href: "/collection" },
    height: "md",
  }}
/>
