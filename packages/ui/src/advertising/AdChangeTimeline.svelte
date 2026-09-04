<script lang="ts">
import Badge from '../Badge.svelte'

/**
 * The campaign change log as readable history (phase 10, TASK-012) —
 * "who paused this" rendered as an ordered timeline, not a JSON dump.
 *
 * The caller prepares everything display-shaped: the heading sentence, the
 * actor's name, the localized field names, the before/after values. What
 * this component owns is the timeline's structure (an ordered list, newest
 * first, with source attribution as a labelled badge) so every advertising
 * screen that shows history shows the same history.
 */
export interface AdChangeItem {
  id: string
  /** The readable sentence, e.g. "Jane paused this campaign". */
  heading: string
  /** Timestamp and other context, one line. */
  meta?: string
  /** Source attribution badge: label plus variant; the app localizes the label. */
  source?: { label: string; variant?: 'neutral' | 'info' | 'warning' | 'success' | 'error' }
  /** Localized names of the fields the change touched. */
  fields?: string[]
  /** Optional per-field before → after lines for changes worth spelling out. */
  details?: { field: string; before: string; after: string }[]
}

interface Labels {
  listLabel?: string
  /** Visible label for a before → after detail line. */
  beforeLabel?: string
  afterLabel?: string
}

interface Props {
  items: AdChangeItem[]
  labels?: Labels
  class?: string
}

let { items, labels = {}, class: className = '' }: Props = $props()

const COPY = {
  listLabel: 'Change history, newest first',
  beforeLabel: 'Before',
  afterLabel: 'After',
}

const display = $derived({
  listLabel: labels.listLabel ?? COPY.listLabel,
  beforeLabel: labels.beforeLabel ?? COPY.beforeLabel,
  afterLabel: labels.afterLabel ?? COPY.afterLabel,
})
</script>

<ol class="sanvi-ad-changes {className}" aria-label={display.listLabel}>
  {#each items as item (item.id)}
    <li class="sanvi-ad-changes__item">
      <div class="sanvi-ad-changes__marker" aria-hidden="true"></div>
      <div class="sanvi-ad-changes__body">
        <p class="sanvi-ad-changes__heading">
          {item.heading}
          {#if item.source}
            <Badge variant={item.source.variant ?? 'neutral'}>{item.source.label}</Badge>
          {/if}
        </p>
        {#if item.meta}<p class="sanvi-ad-changes__meta">{item.meta}</p>{/if}
        {#if item.fields && item.fields.length > 0}
          <ul class="sanvi-ad-changes__fields">
            {#each item.fields as field (field)}
              <li>{field}</li>
            {/each}
          </ul>
        {/if}
        {#if item.details && item.details.length > 0}
          <dl class="sanvi-ad-changes__details">
            {#each item.details as detail (detail.field)}
              <div class="sanvi-ad-changes__detail">
                <dt>{detail.field}</dt>
                <dd>
                  <span class="sanvi-visually-hidden">{display.beforeLabel}: </span>
                  {detail.before}
                  <span aria-hidden="true"> → </span>
                  <span class="sanvi-visually-hidden">{display.afterLabel}: </span>
                  {detail.after}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .sanvi-ad-changes {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sanvi-ad-changes__item {
    display: flex;
    gap: var(--sanvi-spacing-3);
    padding-block-end: var(--sanvi-spacing-5);
  }

  .sanvi-ad-changes__marker {
    flex: none;
    width: var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-border-default);
  }

  .sanvi-ad-changes__body {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-ad-changes__heading {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    flex-wrap: wrap;
    margin: 0;
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-changes__meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-changes__fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--sanvi-spacing-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-changes__details {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    margin: 0;
  }

  .sanvi-ad-changes__detail dt {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-changes__detail dd {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
