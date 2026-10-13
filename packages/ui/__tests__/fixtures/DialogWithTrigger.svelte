<script lang="ts">
import Dialog from '../../src/Dialog.svelte'

let open = $state(false)
</script>

<button type="button" onclick={() => (open = true)}>Open dialog</button>
<button type="button" onclick={() => (open = false)}>Close from parent</button>

<Dialog {open} titleText="Confirm" closeLabel="Close">
  {#snippet children()}
    <p>Are you sure?</p>
  {/snippet}
</Dialog>
