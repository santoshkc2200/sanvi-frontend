<script lang="ts">
import '@sanvi/ui/styles.css'
import type { Snippet } from 'svelte'

let { children }: { children: Snippet } = $props()
</script>

{@render children()}
