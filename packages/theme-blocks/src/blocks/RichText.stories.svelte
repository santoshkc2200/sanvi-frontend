<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import RichText from './RichText.svelte'

const { Story } = defineMeta({
  title: 'Blocks/RichText',
  component: RichText,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Crafted for Performance",
    body: "Every piece in our catalog is engineered to the highest standard.\n\nBuilt with care and attention to detail.",
    align: "left",
  }}
/>

<Story
  name="Centered"
  args={{
    heading: "Our Philosophy",
    body: "Simplicity, durability, and thoughtful design.",
    align: "center",
  }}
/>
