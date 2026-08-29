<script lang="ts">
import { t } from '@sanvi/i18n'
import { Alert, Button, Container, Field, Spinner, Stack, Textarea } from '@sanvi/ui'
import { appealRequest } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'
import { localePath } from '$lib/links'

/**
 * Appeal of a refused request. The authority's complaint route is rendered
 * from the appeal response — the jurisdiction profile is the source, never
 * this page.
 */
export const ssr = false

type AppealOutput = components['schemas']['AppealRequestOutput']

const COPY = $derived({
  title: t['privacy.appeal.title'](),
  intro: t['privacy.appeal.intro'](),
  reasonLabel: t['privacy.appeal.reasonLabel'](),
  submit: t['privacy.appeal.submit'](),
  busy: t['privacy.appeal.busy'](),
  successTitle: t['privacy.appeal.successTitle'](),
  dueLabel: t['privacy.appeal.dueLabel'](),
  authorityTitle: t['privacy.appeal.authorityTitle'](),
  authorityIntro: t['privacy.appeal.authorityIntro'](),
  complaintLink: t['privacy.appeal.complaintLink'](),
  backLink: t['privacy.appeal.backLink'](),
  errorBody: t['privacy.appeal.errorBody'](),
})

let { params }: { params: { id: string } } = $props()

let reason = $state('')
let submitting = $state(false)
let failed = $state(false)
let result = $state<AppealOutput | null>(null)

async function submit(): Promise<void> {
  if (submitting || reason.trim().length === 0) return
  submitting = true
  failed = false
  try {
    result = await appealRequest(apiClient, params.id, { reason })
  } catch {
    failed = true
  } finally {
    submitting = false
  }
}
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if result}
      <Alert variant="success" title={COPY.successTitle}>
        <Stack>
          <span>{COPY.dueLabel}: {formatDate(result.due_at)}</span>
        </Stack>
      </Alert>
      <section aria-labelledby="sanvi-authority">
        <h2 id="sanvi-authority">{COPY.authorityTitle}</h2>
        <p>{COPY.authorityIntro}</p>
        <p>
          <strong>{result.authority.name}</strong> —
          <a href={result.authority.complaint_url} rel="noreferrer">{COPY.complaintLink}</a>
        </p>
      </section>
    {:else}
      <Field label={COPY.reasonLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={reason} />
        {/snippet}
      </Field>
      {#if failed}
        <Alert variant="error">{COPY.errorBody}</Alert>
      {/if}
      <div>
        {#if submitting}
          <Spinner label={COPY.busy} />
        {:else}
          <Button onclick={submit} disabled={reason.trim().length === 0}>{COPY.submit}</Button>
        {/if}
      </div>
    {/if}
    <a href={localePath(`/privacy/requests/${params.id}`)}>{COPY.backLink}</a>
  </Stack>
</Container>
