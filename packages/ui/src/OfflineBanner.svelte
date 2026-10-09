<script lang="ts">
/**
 * The connectivity banner (TASK-023 step 7): shown while the browser reports
 * the tab offline. Honest by construction — it says what still works and
 * what does not, rather than promising that queued actions will fire. Copy
 * arrives as props; the marker is the e2e contract for the offline variant.
 */
interface Props {
  title: string
  description?: string
  class?: string
}

let { title, description, class: className = '' }: Props = $props()
</script>

<div class="sanvi-offline-banner {className}" role="status" data-connectivity="offline">
  <div class="sanvi-offline-banner__text">
    <p class="sanvi-offline-banner__title">{title}</p>
    {#if description}
      <p class="sanvi-offline-banner__description">{description}</p>
    {/if}
  </div>
</div>

<style>
  .sanvi-offline-banner {
    display: flex;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-status-warning);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-offline-banner__text {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-offline-banner__title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-offline-banner__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
