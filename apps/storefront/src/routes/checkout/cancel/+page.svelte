<script lang="ts">
import { t } from '@sanvi/i18n'
import { OrderSummary } from '$lib/checkout'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>{t['storefront.checkout.title']()}</title>
</svelte:head>

<OrderSummary canceled={data.canceled} />
