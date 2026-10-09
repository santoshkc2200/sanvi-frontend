<script lang="ts">
/**
 * The operator-signal banner (TASK-025 step 4): visibility is driven by the
 * readiness probe (`getSystemReadiness`), never by a second manual toggle —
 * setting the signal shows the banner, clearing it removes it. Copy arrives
 * as props; the marker is the e2e contract.
 *
 * Dismissible where informational, persistent where the user's action would
 * fail: `maintenance` renders a polite `status` with a dismiss control;
 * `degraded` renders an `alert` with no dismiss control at all.
 */
interface Props {
  kind: 'maintenance' | 'degraded'
  title: string
  description?: string
  statusHref?: string
  statusLinkLabel?: string
  dismissLabel?: string
  class?: string
}

let {
  kind,
  title,
  description,
  statusHref,
  statusLinkLabel,
  dismissLabel = 'Dismiss',
  class: className = '',
}: Props = $props()

let dismissed = $state(false)
const visible = $derived(kind === 'degraded' ? true : !dismissed)

// A new signal un-dismisses: dismissing "redis is slow" must not hide a
// later "database is slow" for the host's lifetime. Escalation to `degraded`
// is unaffected (it is never dismissible).
$effect(() => {
  void kind
  void title
  void description
  dismissed = false
})
</script>

{#if visible}
  {#if kind === 'maintenance'}
    <div
      class="sanvi-status-banner sanvi-status-banner--maintenance {className}"
      role="status"
      data-system-banner="maintenance"
    >
      <div class="sanvi-status-banner__text">
        <p class="sanvi-status-banner__title">{title}</p>
        {#if description}
          <p class="sanvi-status-banner__description">{description}</p>
        {/if}
        {#if statusHref && statusLinkLabel}
          <a class="sanvi-status-banner__link" href={statusHref}>{statusLinkLabel}</a>
        {/if}
      </div>
      <button
        type="button"
        class="sanvi-status-banner__dismiss"
        onclick={() => {
          dismissed = true
        }}
      >
        {dismissLabel}
      </button>
    </div>
  {:else}
    <div
      class="sanvi-status-banner sanvi-status-banner--degraded {className}"
      role="alert"
      data-system-banner="degraded"
    >
      <div class="sanvi-status-banner__text">
        <p class="sanvi-status-banner__title">{title}</p>
        {#if description}
          <p class="sanvi-status-banner__description">{description}</p>
        {/if}
        {#if statusHref && statusLinkLabel}
          <a class="sanvi-status-banner__link" href={statusHref}>{statusLinkLabel}</a>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .sanvi-status-banner {
    display: flex;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-status-warning);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-status-banner--degraded {
    border-block-end-color: var(--sanvi-color-status-danger);
  }

  .sanvi-status-banner__text {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    flex: 1;
  }

  .sanvi-status-banner__title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-status-banner__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-status-banner__link {
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-link-primary);
    text-decoration: underline;
    align-self: flex-start;
  }

  .sanvi-status-banner__dismiss {
    flex: none;
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: transparent;
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-sm);
    cursor: pointer;
  }

  .sanvi-status-banner__dismiss:hover {
    background: var(--sanvi-color-background-primary);
  }
</style>
