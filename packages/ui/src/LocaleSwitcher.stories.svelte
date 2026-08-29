<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import LocaleSwitcher from './LocaleSwitcher.svelte'

const { Story } = defineMeta({
  title: 'Components/LocaleSwitcher',
  component: LocaleSwitcher,
  tags: ['autodocs'],
})
</script>

<Story
  name="Two locales"
  args={{
    options: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' },
    ],
    current: 'en',
    label: 'Switch language',
    onSwitch: (code: string) => console.log('switch to', code),
  }}
/>
