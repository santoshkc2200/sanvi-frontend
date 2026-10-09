<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert } from '@sanvi/ui'
import { OrderSummary } from '$lib/checkout'
import { isOffline } from '$lib/online.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

// TASK-023 honesty rule: checkout is the one action that is *never* queued
// offline — money must not move on a maybe. While the tab is offline the
// buyer is told plainly that nothing was placed and nothing will be.
const offlineWarning = $derived(isOffline() ? t['storefront.checkout.offlineWarning']() : null)
</script>

<svelte:head>
  <title>{t['storefront.checkout.title']()}</title>
</svelte:head>

<!--
  `cannot_accept_reason` is deliberately not passed through: the backend's
  `payments.blocker.*` keys describe the *merchant's* onboarding state and
  are meant for the admin console. A buyer gets the storefront's own copy.
-->
{#if offlineWarning}
  <Alert variant="warning">{offlineWarning}</Alert>
{/if}
<OrderSummary
  canceled={data.canceled}
  canAcceptPayments={data.config?.can_accept_payments ?? false}
  currency={data.config?.currency ?? undefined}
  taxEnabled={data.config?.tax_enabled ?? true}
/>
