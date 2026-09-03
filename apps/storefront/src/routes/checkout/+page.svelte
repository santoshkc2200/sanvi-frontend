<script lang="ts">
import { t } from '@sanvi/i18n'
import { OrderSummary } from '$lib/checkout'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>{t['storefront.checkout.title']()}</title>
</svelte:head>

<!--
  `cannot_accept_reason` is deliberately not passed through: the backend's
  `payments.blocker.*` keys describe the *merchant's* onboarding state and
  are meant for the admin console. A buyer gets the storefront's own copy.
-->
<OrderSummary
  canceled={data.canceled}
  canAcceptPayments={data.config?.can_accept_payments ?? false}
  currency={data.config?.currency ?? undefined}
/>
