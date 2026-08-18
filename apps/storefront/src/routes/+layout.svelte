<script lang="ts">
import { setSessionContext } from '@sanvi/auth'
import { SuspendedTenantNotice } from '@sanvi/ui'
import '@sanvi/ui/styles.css'
import { setTenantContext } from '@sanvi/tenant'
import { untrack } from 'svelte'
import type { Snippet } from 'svelte'
import type { LayoutData } from './$types'

let { data, children }: { data: LayoutData; children: Snippet } = $props()

// SSR-safe: Svelte context is per-request (per component tree), never a
// module-level singleton — see `@sanvi/tenant`'s `context.ts`. `untrack`
// makes the one-time-read intent explicit: `setContext` only runs during
// component init anyway, so there's nothing to react to even if `data`
// could change later (it can't, within one SSR response).
setTenantContext(untrack(() => data.tenant))
setSessionContext(untrack(() => data.session))

const lockedReason = $derived(
  data.tenant && data.tenant.status !== 'active' ? data.tenant.status : null,
)
</script>

{#if lockedReason}
  <SuspendedTenantNotice reason={lockedReason} />
{:else}
  {@render children()}
{/if}
