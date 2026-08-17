<script lang="ts">
import { type SpacingScale, spacingVar } from '../tokens'

interface Props {
  /**
   * Fixed size from the spacing scale. Omit to make the spacer flexible
   * (`flex: 1`) instead — pushing siblings apart inside a Stack/Cluster.
   */
  size?: SpacingScale
  axis?: 'block' | 'inline'
}

let { size, axis = 'block' }: Props = $props()

const dimension = $derived(size === undefined ? undefined : spacingVar(size))
</script>

<span
  class="sanvi-spacer"
  aria-hidden="true"
  style={dimension === undefined
    ? 'flex: 1;'
    : axis === 'block'
      ? `block-size: ${dimension}; flex: none;`
      : `inline-size: ${dimension}; flex: none;`}
></span>

<style>
  .sanvi-spacer {
    display: block;
  }
</style>
