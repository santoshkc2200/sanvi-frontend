<script lang="ts">
import Badge from './Badge.svelte'
import Stack from './layout/Stack.svelte'

/**
 * The retention report view (TASK-028): per-class status from the backend's
 * live report — the rule, its last recorded run with the rows it affected,
 * and the oldest surviving row — with an executor-backed class that has not
 * run inside its staleness window visibly flagged. Data-driven on purpose:
 * `ui` never imports the data layer, so the evidence-pack surfaces
 * (TASK-029) reuse this component over the same shape instead of copying it.
 *
 * A class with no scheduled executor renders its enforcement as a fact (the
 * honest "who enforces this" inventory), never as an empty row.
 */

/** One class's report row — structurally the backend report's class entry. */
export interface RetentionClassRow {
  dataClass: string
  sensitivity: string
  basis?: string | undefined
  periodDays: number
  action: string
  /** `executor:<name>` | `by-construction (…)` | `tenant-lifecycle` | `unenforced`. */
  enforcement: string
  executor?: string | undefined
  lastRun?:
    | {
        runAt: string
        action: string
        rowsAffected: number
        executor: string
      }
    | undefined
  oldestSurvivingRow?: string | undefined
  /** `true` = executor-backed and past the window; `undefined` = not applicable. */
  stalled?: boolean | undefined
}

interface Props {
  classes: RetentionClassRow[]
  /** Preformatted "generated at" line for the report's header. */
  generatedAtLabel?: string
  /** Preformatted staleness-window line. */
  stalenessLabel?: string
  classHeader?: string
  ruleHeader?: string
  lastRunHeader?: string
  oldestHeader?: string
  statusHeader?: string
  /** Rendered for a class whose last run has no rows-affected fact. */
  noRunLabel?: string
  /** The visible flag on a stalled row — words, never colour alone. */
  stalledLabel?: string
  statusOkLabel?: string
  stalledBannerTitle?: string
  stalledBannerBody?: string
  caption?: string
  /** The rule's day-count suffix — "d" in English, "日" in Japanese. */
  ruleDaysSuffix?: string
  /** The last-run rows label — composed as `{count} {label}`. */
  lastRunRowsLabel?: string
  class?: string
}

let {
  classes,
  generatedAtLabel,
  stalenessLabel,
  classHeader = 'Class',
  ruleHeader = 'Rule',
  lastRunHeader = 'Last run',
  oldestHeader = 'Oldest surviving row',
  statusHeader = 'Status',
  noRunLabel = 'No scheduled run',
  stalledLabel = 'Past window',
  statusOkLabel = 'Ran inside window',
  stalledBannerTitle,
  stalledBannerBody,
  caption = 'Retention status per data class',
  ruleDaysSuffix = 'd',
  lastRunRowsLabel = 'rows',
  class: className = '',
}: Props = $props()

const stalledClasses = $derived(classes.filter((entry) => entry.stalled === true))

function ruleText(entry: RetentionClassRow): string {
  const basis = entry.basis ? ` (${entry.basis})` : ''
  return `${entry.periodDays}${ruleDaysSuffix} ${entry.action}${basis}`
}

function lastRunText(entry: RetentionClassRow): string {
  if (!entry.lastRun) return noRunLabel
  const at = new Date(entry.lastRun.runAt)
  const when = Number.isNaN(at.getTime()) ? entry.lastRun.runAt : at.toLocaleString()
  return `${when} — ${entry.lastRun.rowsAffected.toLocaleString()} ${lastRunRowsLabel} (${entry.lastRun.executor})`
}

function oldestText(entry: RetentionClassRow): string {
  if (!entry.oldestSurvivingRow) return '—'
  const at = new Date(entry.oldestSurvivingRow)
  return Number.isNaN(at.getTime()) ? entry.oldestSurvivingRow : at.toLocaleDateString()
}
</script>

<div class="sanvi-retention {className}" data-retention="report">
  <Stack gap="3">
    {#if generatedAtLabel || stalenessLabel}
      <p class="sanvi-retention__meta">
        {#if generatedAtLabel}{generatedAtLabel}{/if}
        {#if generatedAtLabel && stalenessLabel} · {/if}
        {#if stalenessLabel}{stalenessLabel}{/if}
      </p>
    {/if}

    {#if stalledClasses.length > 0 && stalledBannerTitle}
      <div
        class="sanvi-retention__stalled-banner"
        role="alert"
        data-retention="stalled-banner"
      >
        <p class="sanvi-retention__stalled-title">{stalledBannerTitle}</p>
        {#if stalledBannerBody}<p class="sanvi-retention__stalled-body">{stalledBannerBody}</p>{/if}
        <ul>
          {#each stalledClasses as entry (entry.dataClass)}
            <li><code>{entry.dataClass}</code></li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="sanvi-retention__table-wrap">
      <table class="sanvi-retention__table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{classHeader}</th>
            <th scope="col">{ruleHeader}</th>
            <th scope="col">{lastRunHeader}</th>
            <th scope="col">{oldestHeader}</th>
            <th scope="col">{statusHeader}</th>
          </tr>
        </thead>
        <tbody>
          {#each classes as entry (entry.dataClass)}
            <tr>
              <th scope="row">
                <code>{entry.dataClass}</code>
                <span class="sanvi-retention__sensitivity">{entry.sensitivity}</span>
              </th>
              <td>{ruleText(entry)}</td>
              <td>{lastRunText(entry)}</td>
              <td>{oldestText(entry)}</td>
              <td>
                {#if entry.stalled === true}
                  <span class="sanvi-retention__stalled" data-retention="stalled">
                    <Badge variant="error">{stalledLabel}</Badge>
                  </span>
                {:else if entry.stalled === false}
                  {statusOkLabel}
                {:else}
                  <span class="sanvi-retention__enforcement" title={entry.enforcement}>
                    {entry.enforcement}
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Stack>
</div>

<style>
  .sanvi-retention__meta {
    color: var(--sanvi-color-text-secondary);
    margin: 0;
  }

  .sanvi-retention__stalled-banner {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-error);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
  }

  .sanvi-retention__stalled-title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-retention__stalled-body {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-retention__table-wrap {
    overflow-x: auto;
  }

  .sanvi-retention__table {
    width: 100%;
    border-collapse: collapse;
  }

  .sanvi-retention__table caption {
    text-align: start;
    color: var(--sanvi-color-text-secondary);
    padding-block-end: var(--sanvi-spacing-2);
  }

  .sanvi-retention__table th,
  .sanvi-retention__table td {
    text-align: start;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    vertical-align: top;
  }

  .sanvi-retention__sensitivity {
    display: block;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-retention__enforcement {
    color: var(--sanvi-color-text-secondary);
    overflow-wrap: anywhere;
  }
</style>
