<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import { localePath } from '$lib/links'
import type { PageData } from './$types'

/**
 * The privacy notice, rendered from the backend's generated view — the same
 * configuration that drives enforcement, so the document cannot describe
 * behaviour the system does not have. Versioned; re-prompts are driven by
 * this version.
 */
type JurisdictionRow = components['schemas']['NoticeJurisdictionView']

let { data }: { data: PageData } = $props()

const COPY = $derived({
  title: t['legal.privacyNotice.title'](),
  versionLabel: t['legal.privacyNotice.versionLabel'](),
  sectionTitle: t['legal.privacyNotice.sectionTitle'](),
  sectionIntro: t['legal.privacyNotice.sectionIntro'](),
  jurisdictionColumn: t['legal.privacyNotice.jurisdictionColumn'](),
  regimeColumn: t['legal.privacyNotice.regimeColumn'](),
  modelColumn: t['legal.privacyNotice.modelColumn'](),
  responseColumn: t['legal.privacyNotice.responseColumn'](),
  gpcColumn: t['legal.privacyNotice.gpcColumn'](),
  retentionTitle: t['legal.privacyNotice.retentionTitle'](),
  retentionIntro: t['legal.privacyNotice.retentionIntro'](),
  subprocessorsTitle: t['legal.privacyNotice.subprocessorsTitle'](),
  subprocessorsIntro: t['legal.privacyNotice.subprocessorsIntro'](),
  subprocessorsLink: t['legal.privacyNotice.subprocessorsLink'](),
  gpcAppliedNote: t['legal.privacyNotice.gpcAppliedNote'](),
  days: (n: number) => t['legal.privacyNotice.periodDays']({ count: n }),
  subprocessorCount: (n: number) => t['legal.privacyNotice.subprocessorCount']({ count: n }),
  unavailableTitle: t['legal.privacyNotice.unavailableTitle'](),
  unavailableBody: t['legal.privacyNotice.unavailableBody'](),
})

const notice = $derived(data.privacy?.notice ?? null)

const jurisdictionColumns: TableColumn<JurisdictionRow>[] = $derived([
  { key: 'code', header: COPY.jurisdictionColumn },
  { key: 'regime', header: COPY.regimeColumn },
  { key: 'consent_model', header: COPY.modelColumn },
  { key: 'response_days', header: COPY.responseColumn },
])
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
        <a href={localePath('/legal/sub-processors')}>{COPY.subprocessorsLink}</a>
      </section>

      {#if notice.jurisdictions.some((entry) => entry.honours_universal_opt_out)}
        <Alert variant="info">{COPY.gpcAppliedNote}</Alert>
      {/if}
    {/if}
  </Stack>
</Container>
