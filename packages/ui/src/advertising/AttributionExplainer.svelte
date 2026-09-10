<script lang="ts">
/**
 * The attribution explainer (phase 10, TASK-016) — the methodology note
 * behind the two ROAS numbers. Presentational by the labels-as-data rule:
 * the caller (dashboard, campaign list) supplies the copy and the
 * per-platform attribution rows, so platform facts stay backend-driven
 * data and never become frontend literals.
 *
 * Wherever a ROAS figure renders, this must be one click away — the
 * callers pair it with an info button and a dialog.
 */
export interface AttributionPlatformRow {
  /** Stable key for the `each` binding and tests. */
  key: string
  /** Platform display name, e.g. "Meta Ads". */
  platform: string
  /** What the platform-reported number counts, and inside which window. */
  attribution: string
}

interface Props {
  title: string
  /** The two-numbers intro, one paragraph per entry. */
  intro: string[]
  platformHeading: string
  sanviHeading: string
  platformRows: AttributionPlatformRow[]
  /** What Sanvi-observed revenue counts and where it comes from. */
  sanviDescription: string
  /** Why the two numbers legitimately differ. */
  whyDifferent: string
  /** Optional restatement-window note. */
  restatement?: string
  class?: string
}

let {
  title,
  intro,
  platformHeading,
  sanviHeading,
  platformRows,
  sanviDescription,
  whyDifferent,
  restatement,
  class: className = '',
}: Props = $props()

const headingId = $props.id()
</script>

<section class="sanvi-attribution {className}" aria-labelledby={headingId}>
  <h3 id={headingId} class="sanvi-attribution__title">{title}</h3>
  {#each intro as paragraph (paragraph)}
    <p class="sanvi-attribution__body">{paragraph}</p>
  {/each}

  <h4 class="sanvi-attribution__heading">{platformHeading}</h4>
  <dl class="sanvi-attribution__rows">
    {#each platformRows as row (row.key)}
      <div class="sanvi-attribution__row">
        <dt class="sanvi-attribution__row-name">{row.platform}</dt>
        <dd class="sanvi-attribution__row-body">{row.attribution}</dd>
      </div>
    {/each}
  </dl>

  <h4 class="sanvi-attribution__heading">{sanviHeading}</h4>
  <p class="sanvi-attribution__body">{sanviDescription}</p>

  <p class="sanvi-attribution__why">{whyDifferent}</p>

  {#if restatement}
    <p class="sanvi-attribution__restatement">{restatement}</p>
  {/if}
</section>

<style>
  .sanvi-attribution {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-attribution__title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-attribution__heading {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-attribution__body {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-attribution__rows {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-attribution__row-name {
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-attribution__row-body {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-attribution__why {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-attribution__restatement {
    margin: 0;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-status-warning);
    background: var(--sanvi-color-background-secondary);
    font-size: var(--sanvi-font-size-sm);
  }
</style>
