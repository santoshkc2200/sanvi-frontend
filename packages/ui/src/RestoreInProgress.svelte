<script lang="ts">
import Container from './layout/Container.svelte'
import EmptyState from './EmptyState.svelte'

/**
 * The restore-in-progress state (TASK-025 step 5): while a tenant is being
 * restored, that tenant's admin shows this honest state rather than an empty
 * dataset — an empty dataset reads as data loss. Copy arrives as props; the
 * marker is the e2e contract (`data-restore="in-progress"` must render, and
 * no empty-dataset copy may render alongside it).
 */
interface Props {
  title: string
  description?: string
  statusHref?: string
  statusLinkLabel?: string
  class?: string
}

let { title, description, statusHref, statusLinkLabel, class: className = '' }: Props = $props()
</script>

<div class="sanvi-restore-in-progress {className}" role="status" data-restore="in-progress">
  <Container size="md" padding="6">
    <EmptyState {title} {description}>
      {#snippet action()}
        {#if statusHref && statusLinkLabel}
          <a class="sanvi-restore-in-progress__link" href={statusHref}>{statusLinkLabel}</a>
        {/if}
      {/snippet}
    </EmptyState>
  </Container>
</div>

<style>
  .sanvi-restore-in-progress {
    padding-block: var(--sanvi-spacing-6);
  }

  .sanvi-restore-in-progress__link {
    display: inline-flex;
    align-items: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-restore-in-progress__link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }
</style>
