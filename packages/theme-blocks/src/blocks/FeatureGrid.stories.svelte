<script module lang="ts">
import { defineMeta } from '@storybook/addon-svelte-csf'
import FeatureGrid from './FeatureGrid.svelte'

const { Story } = defineMeta({
  title: 'Blocks/FeatureGrid',
  component: FeatureGrid,
  tags: ['autodocs'],
})
</script>

<Story
  name="Default"
  args={{
    heading: "Built for Performance",
    subheading: "Everything you need to run your store smoothly.",
    columns: 3,
    features: [
      { title: "Lightning Fast", description: "Sub-second SSR response times across all pages." },
      { title: "Fully Accessible", description: "Zero axe violations and full keyboard navigation." },
      { title: "Customizable", description: "Instant token and layout switches without redeploying." },
    ],
  }}
/>
