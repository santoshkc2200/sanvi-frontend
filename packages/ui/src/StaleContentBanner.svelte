<script lang="ts">
/**
 * The degraded-content banner (TASK-023 step 4, "honesty over reassurance"):
 * rendered whenever a surface is serving cached or fallback content during a
 * backend outage — the degraded response must *say* it is degraded and name
 * what is stale, never render as if it were normal. Copy arrives as props.
 */
interface Props {
  title: string
  description?: string
  class?: string
}

let { title, description, class: className = '' }: Props = $props()
</script>

<div class="sanvi-stale-banner {className}" role="status" data-degraded="stale">
  <div class="sanvi-stale-banner__text">
    <p class="sanvi-stale-banner__title">{title}</p>
    {#if description}
      <p class="sanvi-stale-banner__description">{description}</p>
    {/if}
  </div>
</div>

<style>
  .sanvi-stale-banner {
    display: flex;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-status-warning);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-stale-banner__text {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-stale-banner__title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-stale-banner__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
