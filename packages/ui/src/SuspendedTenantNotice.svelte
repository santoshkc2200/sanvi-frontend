<script lang="ts">
import EmptyState from './EmptyState.svelte'
import Container from './layout/Container.svelte'

interface Props {
  /** Mirrors the backend's `423` `reason` (`sanvi-backend`'s `locked_problem`) and the tenant's own `status` for the storefront's own-tenant branch. */
  reason: 'suspended' | 'provisioning' | 'archived'
  traceId?: string
  /** Inert until phase 04 ships the billing UI this links to. */
  billingHref?: string
}

let { reason, traceId, billingHref }: Props = $props()

const showBillingLink = $derived(reason === 'suspended' && Boolean(billingHref))

const COPY = {
  title: {
    suspended: 'This tenant is suspended',
    provisioning: 'This tenant is still being set up',
    archived: 'This tenant is no longer available',
  },
  description: {
    suspended:
      'Access is paused, usually over a billing issue. Resolve it from the billing page to restore access.',
    provisioning:
      'Setup is still in progress. This usually takes a few minutes — try again shortly.',
    archived: 'This tenant was archived and is no longer accessible.',
  },
  billingLink: 'Go to billing',
  traceIdLabel: (id: string) => `Reference: ${id}`,
}
</script>

<Container size="md" padding="6">
  {#if showBillingLink}
    <EmptyState title={COPY.title[reason]} description={COPY.description[reason]}>
      {#snippet action()}
        <a class="sanvi-suspended-tenant-notice__billing-link" href={billingHref}>{COPY.billingLink}</a>
      {/snippet}
    </EmptyState>
  {:else}
    <EmptyState title={COPY.title[reason]} description={COPY.description[reason]} />
  {/if}
  {#if traceId}
    <p class="sanvi-suspended-tenant-notice__trace">{COPY.traceIdLabel(traceId)}</p>
  {/if}
</Container>

<style>
  .sanvi-suspended-tenant-notice__billing-link {
    display: inline-flex;
    align-items: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
  }
  .sanvi-suspended-tenant-notice__billing-link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-suspended-tenant-notice__trace {
    margin-block-start: var(--sanvi-spacing-4);
    text-align: center;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
