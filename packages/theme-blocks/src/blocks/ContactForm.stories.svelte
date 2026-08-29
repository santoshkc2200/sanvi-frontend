<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import ContactForm from './ContactForm.svelte'

const { Story } = defineMeta({
  title: 'Blocks/ContactForm',
  component: ContactForm,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Get in Touch",
    description: "Send us a message and our team will get back to you within 24 hours.",
  }}
/>
