<script lang="ts">
import type { SpacingScale } from '@sanvi/ui/tokens'

interface Props {
  size?: SpacingScale | string
  axis?: 'block' | 'inline'
  class?: string
}

let { size = '6', axis = 'block', class: className = '' }: Props = $props()

const dimension = $derived(size ? `var(--sanvi-spacing-${size})` : undefined)
</script>

<div
  class="sanvi-block-spacer {className}"
  aria-hidden="true"
  style={dimension === undefined
    ? "flex: 1;"
    : axis === "block"
      ? `block-size: ${dimension}; flex: none;`
      : `inline-size: ${dimension}; flex: none;`}
></div>

<style>
  .sanvi-block-spacer {
    display: block;
    width: 100%;
  }
</style>
