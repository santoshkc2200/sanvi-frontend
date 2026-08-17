<script lang="ts">
// Static hosting has no server for a real health endpoint — this route is
// what a synthetic monitor hits instead, importing package.json's version
// through the same `__APP_VERSION__` define the SvelteKit apps use.
</script>

<pre>{JSON.stringify({ status: 'ok', version: __APP_VERSION__ }, null, 2)}</pre>
