<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import FAQ from './FAQ.svelte'

const { Story } = defineMeta({
  title: 'Blocks/FAQ',
  component: FAQ,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Frequently Asked Questions",
    subheading: "Got questions? We have answers.",
    items: [
      {
        question: "What payment methods do you accept?",
        answer: "We support all major credit cards, Apple Pay, Google Pay, and bank transfers.",
      },
      {
        question: "How do I track my order?",
        answer: "You will receive an automated tracking email as soon as your order ships.",
      },
    ],
  }}
/>
