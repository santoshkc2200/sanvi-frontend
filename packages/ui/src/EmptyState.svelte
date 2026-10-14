<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  title: string
  description?: string
  icon?: Snippet
  action?: Snippet
  /**
   * The title's heading level. Defaults to `h2` (a section state under the
   * page's h1); a state that *is* the page — an error view, an outage view —
   * passes `h1` so the page still has a level-one heading (TASK-027).
   */
  titleTag?: 'h1' | 'h2' | 'h3'
  /**
   * The archived-range variant (TASK-028): this absence is not "nothing
   * happened" but "the period you asked for is in cold storage". Rendered on
   * the same empty state rather than a new component, so every surface that
   * already handles empty inherits the honest case instead of forgetting it.
   * The e2e contract is `data-archived="range"` alongside
   * `data-async-state="empty"`.
   */
  variant?: 'default' | 'archived'
  /** The restore path (runbook/docs), named when the variant is archived. */
  restoreHref?: string
  restoreLinkLabel?: string
  class?: string
}

let {
  title,
  description,
  icon,
  action,
  titleTag = 'h2',
  variant = 'default',
  restoreHref,
  restoreLinkLabel,
  class: className = '',
}: Props = $props()

const archived = $derived(variant === 'archived')
</script>

<div
  class="sanvi-empty-state {className}"
  class:sanvi-empty-state--archived={archived}
  data-async-state="empty"
  data-archived={archived ? 'range' : undefined}
>
  {#if icon}
    <div class="sanvi-empty-state__icon" aria-hidden="true">
      {@render icon()}
    </div>
  {/if}
  <svelte:element this={titleTag} class="sanvi-empty-state__title">{title}</svelte:element>
  {#if description}
    <p class="sanvi-empty-state__description">{description}</p>
  {/if}
  {#if archived && restoreHref && restoreLinkLabel}
    <div class="sanvi-empty-state__action">
      <a
        class="sanvi-empty-state__restore-link"
        href={restoreHref}
        target="_blank"
        rel="noreferrer">{restoreLinkLabel}</a
      >
    </div>
  {:else if action}
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

  .sanvi-empty-state__restore-link {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-medium);
    text-decoration: underline;
    text-underline-offset: var(--sanvi-spacing-1);
  }

  .sanvi-empty-state__restore-link:hover {
    color: var(--sanvi-color-text-secondary);
  }

  /* The archived variant's border marks the panel as set apart from a plain
     "nothing here" — a state the operator must not skim past. */
  .sanvi-empty-state--archived {
    border: var(--sanvi-border-width-thin) dashed var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }
</style>
