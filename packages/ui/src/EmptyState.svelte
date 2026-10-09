<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  title: string
  description?: string
  icon?: Snippet
  action?: Snippet
  class?: string
}

let { title, description, icon, action, class: className = '' }: Props = $props()
</script>

<div class="sanvi-empty-state {className}" data-async-state="empty">
  {#if icon}
    <div class="sanvi-empty-state__icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}
  <p class="sanvi-empty-state__title">{title}</p>
  {#if description}
    <p class="sanvi-empty-state__description">{description}</p>
  {/if}
  {#if action}
    <div class="sanvi-empty-state__action">
      {@render action()}
    </div>
  {/if}
</div>

<style>
  .sanvi-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-12) var(--sanvi-spacing-4);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-empty-state__icon {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-empty-state__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-empty-state__description {
    margin: 0;
    max-width: 40ch;
  }

  .sanvi-empty-state__action {
    margin-block-start: var(--sanvi-spacing-2);
  }
</style>
