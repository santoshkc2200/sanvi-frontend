<script lang="ts">
import { applyTheme, renderLayout, themeStyleTag } from '@sanvi/theme-runtime'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

$effect(() => {
  if (data.theme) {
    applyTheme(data.theme)
  }
})

const layoutTree = $derived(
  renderLayout('storefront.home', {
    theme: data.theme,
  }),
)

const previewSlots = $derived(
  layoutTree.slots.filter((s) => s.name !== 'header' && s.name !== 'footer'),
)
</script>

<svelte:head>
  {@html themeStyleTag(data.theme)}
  {#if data.theme?.fonts}
    {#each data.theme.fonts as font (font.source)}
      <link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={font.source} />
    {/each}
  {/if}
</svelte:head>

<div class="sanvi-theme-preview">
  {#each previewSlots as slot (slot.name)}
    {#each slot.blocks as block (block.id)}
      <block.component {...block.props} />
    {/each}
  {/each}
</div>

<style>
  .sanvi-theme-preview {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
