<script lang="ts">
import type { Snippet } from 'svelte'
import { type SpacingScale, spacingVar } from '../tokens'

interface Props {
  /** Number of equal-width columns, or a raw `grid-template-columns` track list for uneven grids. */
  columns?: number | string
  gap?: SpacingScale
  as?: string
  class?: string
  children: Snippet
}

let { columns = 2, gap = '4', as = 'div', class: className = '', children }: Props = $props()

const templateColumns = $derived(
  typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns,
)
</script>

<svelte:element
  this={as}
  class="sanvi-grid {className}"
  style:--sanvi-grid-columns={templateColumns}
  style:--sanvi-grid-gap={spacingVar(gap)}
>
  {@render children()}
</svelte:element>

<style>
  .sanvi-grid {
    display: grid;
    grid-template-columns: var(--sanvi-grid-columns);
    gap: var(--sanvi-grid-gap);
  }
</style>
