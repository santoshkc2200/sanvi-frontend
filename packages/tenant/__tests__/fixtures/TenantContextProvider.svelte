<script lang="ts">
import { setTenantContext } from '../../src/context'
import type { TenantContext } from '../../src/types'
import { untrack } from 'svelte'
import TenantContextConsumer from './TenantContextConsumer.svelte'

interface Props {
  tenant: TenantContext | null
}

let { tenant }: Props = $props()
setTenantContext(untrack(() => tenant))
</script>

<TenantContextConsumer />
