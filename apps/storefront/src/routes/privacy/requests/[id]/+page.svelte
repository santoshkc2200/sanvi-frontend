<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Badge, Container, EmptyState, Spinner, Stack } from '@sanvi/ui'
import { getDsrStatus, exportDownloadUrl } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { getAppEnv } from '$lib/env'
import { formatDate } from '$lib/format'
import { localePath } from '$lib/links'
import type { PageData } from './$types'

/**
 * A single DSR's status, for the subject. Owned by the session, or by the
 * `?token=` challenge for anonymous requesters. The download section is
 * honest about the passphrase: it arrives out of band, and the link is
 * single-use and expiring.
 */
export const ssr = false

let { data, params }: { data: PageData; params: { id: string } } = $props()

type StatusView = components['schemas']['GetRequestStatusOutput']

const COPY = $derived({
  title: t['privacy.requestDetail.title'](),
  kindLabel: t['privacy.requestDetail.kindLabel'](),
  statusLabel: t['privacy.requestDetail.statusLabel'](),
  receivedLabel: t['privacy.requestDetail.receivedLabel'](),
  acknowledgedLabel: t['privacy.requestDetail.acknowledgedLabel'](),
  dueLabel: t['privacy.requestDetail.dueLabel'](),
  extendedLabel: t['privacy.requestDetail.extendedLabel'](),
  completedLabel: t['privacy.requestDetail.completedLabel'](),
  jurisdictionLabel: t['privacy.requestDetail.jurisdictionLabel'](),
  backLink: t['privacy.requestDetail.backLink'](),
  loadTitle: t['privacy.requestDetail.loadTitle'](),
  notFoundTitle: t['privacy.requestDetail.notFoundTitle'](),
  notFoundBody: t['privacy.requestDetail.notFoundBody'](),
  rejectedTitle: t['privacy.requestDetail.rejectedTitle'](),
  appealCta: t['privacy.appeal.title'](),
  downloadTitle: t['privacy.requestDetail.downloadTitle'](),
  downloadBody: t['privacy.requestDetail.downloadBody'](),
  downloadLink: t['privacy.requestDetail.downloadLink'](),
  downloadNoToken: t['privacy.requestDetail.downloadNoToken'](),
  timelineLabel: t['privacy.requestDetail.timelineLabel'](),
})

const downloadToken = $derived(new URLSearchParams(window.location.search).get('token'))
const downloadHref = $derived(
  downloadToken ? exportDownloadUrl(getAppEnv().apiOrigin, params.id, downloadToken) : null,
)

let status = $state<StatusView | null>(null)
let loading = $state(true)
let notFound = $state(false)

$effect(() => {
  const pageToken = new URLSearchParams(window.location.search).get('token') ?? undefined
  getDsrStatus(apiClient, params.id, pageToken ? { token: pageToken } : undefined)
    .then((result) => {
      status = result
      loading = false
    })
    .catch(() => {
      notFound = true
      loading = false
    })
})

const statusVariant = $derived(
  status?.status === 'completed'
    ? 'success'
    : status?.status === 'rejected'
      ? 'error'
      : status?.status === 'under_appeal' || status?.status === 'on_hold'
        ? 'warning'
        : 'info',
)

const steps = $derived.by(() => {
  if (!status) return [] as { label: string; at: string | null }[]
  return [
    { label: COPY.receivedLabel, at: status.received_at },
    { label: COPY.acknowledgedLabel, at: status.acknowledged_at },
    { label: COPY.extendedLabel, at: status.extended_to },
    { label: COPY.dueLabel, at: status.due_at },
    { label: COPY.completedLabel, at: status.completed_at },
  ]
})
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>

    {#if loading}
      <Spinner label={COPY.loadTitle} />
    {:else if notFound || !status}
      <EmptyState title={COPY.notFoundTitle} description={COPY.notFoundBody} />
      <a href={localePath('/privacy/requests')}>{COPY.backLink}</a>
    {:else}
      <p><strong>{COPY.kindLabel}:</strong> {status.kind}</p>
      <p>
        <strong>{COPY.statusLabel}:</strong>
        <Badge variant={statusVariant}>{status.status}</Badge>
      </p>
      <p><strong>{COPY.jurisdictionLabel}:</strong> {status.jurisdiction}</p>

      <h2>{COPY.timelineLabel}</h2>
      <ol>
        {#each steps as step (step.label)}
          <li>
            {step.label}
            {#if step.at}
              — {formatDate(step.at)}
            {:else}
              —
            {/if}
          </li>
        {/each}
      </ol>

      {#if status.rejection_reason}
        <Alert variant="warning" title={COPY.rejectedTitle}>
          <Stack>
            <span>{status.rejection_reason}</span>
            <a href={localePath(`/privacy/requests/${params.id}/appeal`)}>{COPY.appealCta}</a>
          </Stack>
        </Alert>
      {/if}

      {#if status.export_available}
        <section aria-labelledby="sanvi-download">
          <h2 id="sanvi-download">{COPY.downloadTitle}</h2>
          <p>{COPY.downloadBody}</p>
          {#if downloadHref}
            <p><a href={downloadHref}>{COPY.downloadLink}</a></p>
          {:else}
            <p>{COPY.downloadNoToken}</p>
          {/if}
        </section>
      {/if}
      <a href={localePath('/privacy/requests')}>{COPY.backLink}</a>
    {/if}
  </Stack>
</Container>
