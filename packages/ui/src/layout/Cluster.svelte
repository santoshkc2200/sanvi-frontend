<script lang="ts">
import type { Snippet } from 'svelte'
import { type SpacingScale, spacingVar } from '../tokens'

interface Props {
  /** Gap between children, from the spacing scale — applies to both axes when wrapped. */
  gap?: SpacingScale
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  wrap?: boolean
  as?: string
  class?: string
  children: Snippet
}

let {
  gap = '2',
  align = 'center',
  justify = 'start',
  wrap = true,
  as = 'div',
  class: className = '',
  children,
}: Props = $props()
</script>

<svelte:element
  this={as}
  class="sanvi-cluster {className}"
  style:--sanvi-cluster-gap={spacingVar(gap)}
  style:--sanvi-cluster-align={align}
  style:--sanvi-cluster-justify={justify}
  style:--sanvi-cluster-wrap={wrap ? 'wrap' : 'nowrap'}
>
  {@render children()}
</svelte:element>

<style>
  .sanvi-cluster {
    display: flex;
    flex-wrap: var(--sanvi-cluster-wrap);
    gap: var(--sanvi-cluster-gap);
    align-items: var(--sanvi-cluster-align);
    justify-content: var(--sanvi-cluster-justify);
  }
</style>
