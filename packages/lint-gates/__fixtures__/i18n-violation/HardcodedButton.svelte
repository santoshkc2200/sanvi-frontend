<script lang="ts">
  let count = $state(0)
</script>

<button type="button" aria-label="Increment counter" onclick={() => (count += 1)}>
  Click me
</button>
<p>You have clicked {count} times</p>
