<script lang="ts">
let { crashes }: { crashes: boolean } = $props()
// Deliberately the init-time value: a test fixture that throws *during
// render*, which is the crash the boundary exists to catch.
// svelte-ignore state_referenced_locally
if (crashes) {
  throw new Error('panel exploded')
}
</script>

<p data-testid="boundary-child-ok">panel content</p>
