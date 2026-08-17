<script lang="ts">
import { getInFlightCount, listCacheEntries } from '../cache'

let entries = $state(listCacheEntries())
let inFlight = $state(getInFlightCount())

const COPY = {
  heading: 'Query cache',
  inFlightLabel: (count: number) => `${count} in flight`,
  emptyLabel: 'No cached entries',
}

$effect(() => {
  const id = setInterval(() => {
    entries = listCacheEntries()
    inFlight = getInFlightCount()
  }, 500)
  return () => clearInterval(id)
})
</script>

<!--
  Self-gated rather than requiring every app to wrap the usage in
  `{#if import.meta.env.DEV}` — Vite dead-code-eliminates this whole branch
  from a production build since `import.meta.env.DEV` is statically `false`
  there, so mounting it unconditionally is free in prod.
-->
{#if import.meta.env.DEV}
  <aside class="sanvi-query-devtools" aria-label={COPY.heading}>
    <p class="sanvi-query-devtools__heading">{COPY.heading} — {COPY.inFlightLabel(inFlight)}</p>
    {#if entries.length === 0}
      <p class="sanvi-query-devtools__empty">{COPY.emptyLabel}</p>
    {:else}
      <ul class="sanvi-query-devtools__list">
        {#each entries as entry (entry.key)}
          <li>
            <code>{entry.key}</code>
            {#if entry.tags.length > 0}
              <span class="sanvi-query-devtools__tags">{entry.tags.join(', ')}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </aside>
{/if}

<style>
  .sanvi-query-devtools {
    position: fixed;
    inset-block-end: var(--sanvi-spacing-2);
    inset-inline-end: var(--sanvi-spacing-2);
    z-index: var(--sanvi-z-index-modal);
    max-inline-size: 20rem;
    max-block-size: 16rem;
    overflow: auto;
    padding: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-query-devtools__heading {
    margin: 0 0 var(--sanvi-spacing-2);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-query-devtools__empty {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-query-devtools__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-query-devtools__tags {
    margin-inline-start: var(--sanvi-spacing-2);
    color: var(--sanvi-color-text-secondary);
  }
</style>
