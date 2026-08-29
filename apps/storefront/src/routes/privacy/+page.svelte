<script lang="ts">
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { Container, EmptyState, Stack, Table, type TableColumn } from '@sanvi/ui'
import { localePath } from '$lib/links'
import type { PageData } from './$types'

/**
 * Privacy centre overview (end user). Everything renders from the backend's
 * notice + notice-at-collection, which the root layout already resolved —
 * this page adds no rules of its own and no jurisdiction branches.
 */
let { data }: { data: PageData } = $props()

const COPY = $derived({
  title: t['privacy.overview.title'](),
  intro: t['privacy.overview.intro'](),
  heldTitle: t['privacy.overview.heldTitle'](),
  heldIntro: t['privacy.overview.heldIntro'](),
  retentionCaption: t['privacy.overview.retentionCaption'](),
  purposesLabel: t['privacy.overview.purposesLabel'](),
  categoriesLabel: t['privacy.overview.categoriesLabel'](),
  retentionColumn: t['privacy.overview.retentionColumn'](),
  afterExpiryColumn: t['privacy.overview.afterExpiryColumn'](),
  rulesTitle: t['privacy.overview.rulesTitle'](),
  rulesIntro: t['privacy.overview.rulesIntro'](),
  jurisdictionLabel: t['privacy.overview.jurisdictionLabel'](),
  regimeLabel: t['privacy.overview.regimeLabel'](),
  responseDaysLabel: t['privacy.overview.responseDaysLabel'](),
  modelLabel: t['privacy.overview.modelLabel'](),
  modelOptIn: t['privacy.overview.modelOptIn'](),
  modelNotice: t['privacy.overview.modelNotice'](),
  days: (n: number) => t['privacy.overview.periodDays']({ count: n }),
  actionsTitle: t['privacy.overview.actionsTitle'](),
  choicesAction: t['privacy.overview.choicesAction'](),
  requestsAction: t['privacy.overview.requestsAction'](),
  erasureAction: t['privacy.overview.erasureAction'](),
  agentAction: t['privacy.overview.agentAction'](),
  unavailableTitle: t['privacy.overview.unavailableTitle'](),
  unavailableBody: t['privacy.overview.unavailableBody'](),
  legalTitle: t['privacy.overview.legalTitle'](),
})

const privacy = $derived(data.privacy)

const jurisdictionView = $derived(
  privacy?.notice?.jurisdictions.find((entry) => entry.code === privacy.snapshot.jurisdiction) ??
    null,
)

const retentionRows = $derived(privacy?.notice?.retention ?? [])

const retentionColumns: TableColumn<components['schemas']['RetentionNoticeRow']>[] = $derived([
  { key: 'category', header: COPY.categoriesLabel },
  { key: 'period_days', header: COPY.retentionColumn },
  { key: 'action', header: COPY.afterExpiryColumn },
])
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
        <a href={localePath('/privacy/choices')}>{COPY.choicesAction}</a>
        <a href={localePath('/privacy/requests')}>{COPY.requestsAction}</a>
        <a href={localePath('/privacy/erasure')}>{COPY.erasureAction}</a>
        <a href={localePath('/privacy/agent')}>{COPY.agentAction}</a>
      </Stack>
    </section>

    <section aria-labelledby="sanvi-legal">
      <h2 id="sanvi-legal">{COPY.legalTitle}</h2>
      <Stack>
        <a href={localePath('/legal/privacy-notice')}>{t['storefront.footer.notice']()}</a>
        <a href={localePath('/legal/cookies')}>{t['legal.cookies.title']()}</a>
        <a href={localePath('/legal/sub-processors')}>{t['legal.subProcessors.title']()}</a>
        <a href={localePath('/legal/request-metrics')}>{t['legal.requestMetrics.title']()}</a>
      </Stack>
    </section>
  </Stack>
</Container>
