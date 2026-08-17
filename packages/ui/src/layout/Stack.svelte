<script lang="ts">
import type { Snippet } from 'svelte'
import { type SpacingScale, spacingVar } from '../tokens'

interface Props {
  /** Gap between children, from the spacing scale. */
  gap?: SpacingScale
  align?: 'start' | 'center' | 'end' | 'stretch'
  /** Element/component to render as. */
  as?: string
  class?: string
  children: Snippet
}

let { gap = '4', align = 'stretch', as = 'div', class: className = '', children }: Props = $props()
</script>

<svelte:element
  this={as}
  class="sanvi-stack {className}"
  style="--sanvi-stack-gap: {spacingVar(gap)}; --sanvi-stack-align: {align};"
>
  {@render children()}
</svelte:element>

<style>
  .sanvi-stack {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-stack-gap);
    align-items: var(--sanvi-stack-align);
  }
</style>
