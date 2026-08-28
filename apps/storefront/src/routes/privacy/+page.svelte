<script lang="ts">
import type { components } from '@sanvi/api-client'
import { Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import type { PageData } from './$types'

/**
 * Privacy centre overview (end user). Everything renders from the backend's
 * notice + notice-at-collection, which the root layout already resolved —
 * this page adds no rules of its own and no jurisdiction branches.
 */
let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Your privacy',
  intro:
    'What this store holds about you, which privacy rules apply, and how to act on it — all in one place.',
  heldTitle: 'What we collect',
  heldIntro: 'The categories collected on this storefront, and how long each is kept:',
  retentionCaption: 'Retention per category',
  purposesLabel: 'Purposes',
  categoriesLabel: 'Categories',
  retentionColumn: 'Retention',
  afterExpiryColumn: 'After expiry',
  rulesTitle: 'Which rules apply',
  rulesIntro:
    'The jurisdiction resolved for you decides how consent works here. This is set by the service, not chosen by the page.',
  jurisdictionLabel: 'Jurisdiction',
  regimeLabel: 'Regime',
  responseDaysLabel: 'Response window',
  modelLabel: 'Consent model',
  modelOptIn: 'Opt-in — nothing non-essential runs before you allow it',
  modelNotice: 'Notice and opt-out — you are told what is collected, and a refusal is honoured',
  days: (n: number) => `${n} days`,
  actionsTitle: 'Act on your data',
  choicesAction: 'Change your privacy choices',
  requestsAction: 'Request a copy, correction or erasure of your data',
  erasureAction: 'Understand and request erasure',
  agentAction: 'Submit as an authorized agent',
  unavailableTitle: 'Privacy surfaces unavailable',
  unavailableBody:
    'The privacy service did not answer for this page. Nothing is collected behind your back — the consent gate fails closed.',
  legalTitle: 'Legal documents',
  cookiesLink: 'Cookie policy',
  subprocessorsLink: 'Sub-processors',
  metricsLink: 'Annual request metrics',
  noticeLink: 'Privacy notice',
}

const privacy = $derived(data.privacy)

const jurisdictionView = $derived(
  privacy?.notice?.jurisdictions.find((entry) => entry.code === privacy.snapshot.jurisdiction) ??
    null,
)

const retentionRows = $derived(privacy?.notice?.retention ?? [])

const retentionColumns: TableColumn<components['schemas']['RetentionNoticeRow']>[] = [
  { key: 'category', header: COPY.categoriesLabel },
  { key: 'period_days', header: COPY.retentionColumn },
  { key: 'action', header: COPY.afterExpiryColumn },
]
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if !privacy}
      <EmptyState title={COPY.unavailableTitle} description={COPY.unavailableBody} />
    {:else}
      {#if privacy.noticeAtCollection}
        <section aria-labelledby="sanvi-held">
          <h2 id="sanvi-held">{COPY.heldTitle}</h2>
          <p>{COPY.heldIntro}</p>
          <p>
            <strong>{COPY.categoriesLabel}:</strong>
            {privacy.noticeAtCollection.categories.join(', ')}
          </p>
          <p>
            <strong>{COPY.purposesLabel}:</strong>
            {privacy.noticeAtCollection.purposes.join(', ')}
          </p>
        </section>
      {/if}

      {#if privacy.notice}
        <section aria-labelledby="sanvi-rules">
          <h2 id="sanvi-rules">{COPY.rulesTitle}</h2>
          <p>{COPY.rulesIntro}</p>
          <p><strong>{COPY.jurisdictionLabel}:</strong> {privacy.snapshot.jurisdiction}</p>
          {#if jurisdictionView}
            <p><strong>{COPY.regimeLabel}:</strong> {jurisdictionView.regime}</p>
            <p>
              <strong>{COPY.responseDaysLabel}:</strong>
              {COPY.days(jurisdictionView.response_days)}
            </p>
            <p>
              <strong>{COPY.modelLabel}:</strong>
              {jurisdictionView.consent_model === 'opt_in' ? COPY.modelOptIn : COPY.modelNotice}
            </p>
          {/if}
        </section>
      {/if}

      {#if retentionRows.length > 0}
        <section aria-labelledby="sanvi-retention">
          <h2 id="sanvi-retention">{COPY.heldTitle}</h2>
          <p>{COPY.heldIntro}</p>
          <Table
            rows={retentionRows}
            getRowId={(row) => `${row.category}-${row.action}`}
            caption={COPY.retentionCaption}
            columns={retentionColumns}
          />
        </section>
      {/if}
    {/if}

    <section aria-labelledby="sanvi-actions">
      <h2 id="sanvi-actions">{COPY.actionsTitle}</h2>
      <Stack>
        <a href="/privacy/choices">{COPY.choicesAction}</a>
        <a href="/privacy/requests">{COPY.requestsAction}</a>
        <a href="/privacy/erasure">{COPY.erasureAction}</a>
        <a href="/privacy/agent">{COPY.agentAction}</a>
      </Stack>
    </section>

    <section aria-labelledby="sanvi-legal">
      <h2 id="sanvi-legal">{COPY.legalTitle}</h2>
      <Stack>
        <a href="/legal/privacy-notice">{COPY.noticeLink}</a>
        <a href="/legal/cookies">{COPY.cookiesLink}</a>
        <a href="/legal/sub-processors">{COPY.subprocessorsLink}</a>
        <a href="/legal/request-metrics">{COPY.metricsLink}</a>
      </Stack>
    </section>
  </Stack>
</Container>
