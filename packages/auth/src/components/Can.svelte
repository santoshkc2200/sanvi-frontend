<script lang="ts">
import type { Snippet } from 'svelte'
import { can } from '../can'

interface Props {
  permission: string
  tenantId?: string
  children: Snippet
  fallback?: Snippet
}

let { permission, tenantId, children, fallback }: Props = $props()
</script>

{#if can(permission, tenantId)}
  {@render children()}
{:else if fallback}
  {@render fallback()}
{/if}
