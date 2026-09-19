<script lang="ts">
import EmptyState from './EmptyState.svelte'
import Container from './layout/Container.svelte'
import ErrorDiagnostics from './errors/ErrorDiagnostics.svelte'

interface Props {
  /** Mirrors the backend's `423` `reason` (`sanvi-backend`'s `locked_problem`) and the tenant's own `status` for the storefront's own-tenant branch. */
  reason: 'suspended' | 'provisioning' | 'archived'
  /** The fully rendered trace-id line (the app localizes `errors.traceId`). */
  traceLine?: string
  /** The one-paste diagnostics text from `buildDiagnosticsPaste`; when set, the copy action renders. */
  diagnosticsText?: string
  copyLabel?: string
  copiedLabel?: string
  /** Inert until phase 04 ships the billing UI this links to. */
  billingHref?: string
}

let { reason, traceLine, diagnosticsText, copyLabel, copiedLabel, billingHref }: Props = $props()

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
  <ErrorDiagnostics {traceLine} {diagnosticsText} {copyLabel} {copiedLabel} />
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
</style>
