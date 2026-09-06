<script lang="ts">
/**
 * The drift diff table (phase 10, TASK-012): one row per changed field,
 * our intent next to the platform's current state. The component renders
 * data it is given — resolving what "ours" and "theirs" say, and localizing
 * field names, is the caller's job (this package stays i18n-free).
 *
 * The two value columns are labelled in words and carry equal visual weight
 * on purpose: neither side is the error side. Drift is a decision the tenant
 * makes, and that decision lives outside this table.
 */
export interface DriftDiffRow {
  /** Human-readable field name, caller-localized. */
  field: string
  /** What Sanvi intended, formatted for display. */
  ours: string
  /** What the platform currently reports, formatted for display. */
  theirs: string
}

interface Labels {
  fieldHeader?: string
  oursHeader?: string
  theirsHeader?: string
  tableCaption?: string
}

interface Props {
  rows: DriftDiffRow[]
  labels?: Labels
  class?: string
}

let { rows, labels = {}, class: className = '' }: Props = $props()

const COPY = {
  fieldHeader: 'Field',
  oursHeader: 'Ours (Sanvi)',
  theirsHeader: 'Theirs (platform, current)',
  tableCaption: 'Differences between Sanvi and the ad platform',
}

const display = $derived({
  fieldHeader: labels.fieldHeader ?? COPY.fieldHeader,
  oursHeader: labels.oursHeader ?? COPY.oursHeader,
  theirsHeader: labels.theirsHeader ?? COPY.theirsHeader,
  tableCaption: labels.tableCaption ?? COPY.tableCaption,
})
</script>

<div class="sanvi-ad-drift-diff {className}">
  <table>
    <caption>{display.tableCaption}</caption>
    <thead>
      <tr>
        <th scope="col">{display.fieldHeader}</th>
        <th scope="col">{display.oursHeader}</th>
        <th scope="col">{display.theirsHeader}</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.field)}
        <tr>
          <th scope="row">{row.field}</th>
          <td>{row.ours}</td>
          <td>{row.theirs}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .sanvi-ad-drift-diff {
    overflow-x: auto;
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  caption {
    text-align: start;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
  }

  th,
  td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: start;
    vertical-align: top;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  thead th {
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
    background: var(--sanvi-color-background-secondary);
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-block-end: none;
  }
</style>
