<script lang="ts">
let { crashes }: { crashes: boolean } = $props()
if (crashes) {
  throw new Error('panel exploded')
}
</script>

<p data-testid="boundary-child-ok">panel content</p>
