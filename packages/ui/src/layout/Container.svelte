<script lang="ts">
import type { Snippet } from 'svelte'
import { type SpacingScale, spacingVar } from '../tokens'

interface Props {
  /** Max content width. `'prose'` caps at a comfortable reading measure. */
  size?: 'sm' | 'md' | 'lg' | 'prose' | 'full'
  /** Horizontal padding, from the spacing scale. */
  padding?: SpacingScale
  as?: string
  class?: string
  children: Snippet
}

const MAX_WIDTH: Record<Exclude<Props['size'], undefined>, string> = {
  sm: '40rem',
  md: '64rem',
  lg: '80rem',
  prose: '65ch',
  full: 'none',
}

let { size = 'lg', padding = '4', as = 'div', class: className = '', children }: Props = $props()

const maxWidth = $derived(MAX_WIDTH[size])
</script>

<svelte:element
  this={as}
  class="sanvi-container {className}"
  style="--sanvi-container-max-width: {maxWidth}; --sanvi-container-padding: {spacingVar(padding)};"
>
  {@render children()}
</svelte:element>

<style>
  .sanvi-container {
    width: 100%;
    max-width: var(--sanvi-container-max-width);
    margin-inline: auto;
    padding-inline: var(--sanvi-container-padding);
  }
</style>
