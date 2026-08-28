<script lang="ts">
import { Alert, Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import type { PageData } from './$types'

/**
 * The privacy notice, rendered from the backend's generated view — the same
 * configuration that drives enforcement, so the document cannot describe
 * behaviour the system does not have. Versioned; re-prompts are driven by
 * this version.
 */
type JurisdictionRow = components['schemas']['NoticeJurisdictionView']

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Privacy notice',
  versionLabel: 'Notice version',
  sectionTitle: 'How the rules differ by location',
  sectionIntro:
    'The table below is generated from the jurisdiction profiles this service actually enforces.',
  jurisdictionColumn: 'Jurisdiction',
  regimeColumn: 'Regime',
  modelColumn: 'Consent model',
  responseColumn: 'Response window',
  gpcColumn: 'Honours browser signals',
  retentionTitle: 'How long we keep things',
  retentionIntro:
    'Retention per data category, generated from the live retention rules — the same rows the erasure page shows you.',
  subprocessorsTitle: 'Sub-processors',
  subprocessorsIntro: 'The companies that process data for this store when we cannot.',
  subprocessorsLink: 'See the full sub-processor list',
  gpcAppliedNote:
    'Browser privacy signals (Global Privacy Control) are honoured where required — a detected signal opts you out of sale and sharing immediately.',
  yes: 'Yes',
  no: 'No',
  days: (n: number) => `${n} days`,
  subprocessorCount: (n: number) =>
    n === 1 ? 'There is currently 1 sub-processor.' : `There are currently ${n} sub-processors.`,
  unavailableTitle: 'Notice unavailable',
  unavailableBody:
    'The privacy service did not answer, so the notice cannot be shown. The consent gate still fails closed.',
}

const notice = $derived(data.privacy?.notice ?? null)

const jurisdictionColumns: TableColumn<JurisdictionRow>[] = [
  { key: 'code', header: COPY.jurisdictionColumn },
  { key: 'regime', header: COPY.regimeColumn },
  { key: 'consent_model', header: COPY.modelColumn },
  { key: 'response_days', header: COPY.responseColumn },
]
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>

    {#if !notice}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
    {:else}
      <p><strong>{COPY.versionLabel}:</strong> {notice.notice_version}</p>

      <section aria-labelledby="sanvi-jurisdictions">
        <h2 id="sanvi-jurisdictions">{COPY.sectionTitle}</h2>
        <p>{COPY.sectionIntro}</p>
        <Table rows={notice.jurisdictions} getRowId={(row) => row.code} caption={COPY.sectionTitle} columns={jurisdictionColumns} />
      </section>

      <section aria-labelledby="sanvi-retention">
        <h2 id="sanvi-retention">{COPY.retentionTitle}</h2>
        <p>{COPY.retentionIntro}</p>
        <ul>
          {#each notice.retention as row (row.category)}
            <li>
              <strong>{row.category}</strong>
              — {COPY.days(row.period_days)},
              {row.action}
            </li>
          {/each}
        </ul>
      </section>

      <section aria-labelledby="sanvi-subprocessors">
        <h2 id="sanvi-subprocessors">{COPY.subprocessorsTitle}</h2>
        <p>{COPY.subprocessorsIntro}</p>
        <p>{COPY.subprocessorCount(notice.subprocessors.length)}</p>
        <a href="/legal/sub-processors">{COPY.subprocessorsLink}</a>
      </section>

      {#if notice.jurisdictions.some((entry) => entry.honours_universal_opt_out)}
        <Alert variant="info">{COPY.gpcAppliedNote}</Alert>
      {/if}
    {/if}
  </Stack>
</Container>
