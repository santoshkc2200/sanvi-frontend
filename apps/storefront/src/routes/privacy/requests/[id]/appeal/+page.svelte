<script lang="ts">
import { Alert, Button, Container, Field, Spinner, Stack, Textarea } from '@sanvi/ui'
import { appealRequest } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'

/**
 * Appeal of a refused request. The authority's complaint route is rendered
 * from the appeal response — the jurisdiction profile is the source, never
 * this page.
 */
export const ssr = false

type AppealOutput = components['schemas']['AppealRequestOutput']

const COPY = {
  title: 'Appeal this decision',
  intro:
    'If your privacy request was refused, you can appeal. A different reviewer who did not make the original decision will look at it again.',
  reasonLabel: 'Why do you think the refusal was wrong?',
  submit: 'Submit appeal',
  busy: 'Submitting…',
  successTitle: 'Appeal received',
  dueLabel: 'Decision expected by',
  authorityTitle: 'You can also complain to the authority',
  authorityIntro:
    'Independent of your appeal, you can raise this with the authority responsible for your jurisdiction:',
  complaintLink: 'File a complaint',
  backLink: 'Back to request status',
  errorBody: 'The appeal could not be submitted. Check the details and try again.',
  loadTitle: 'Loading…',
}

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
    <a href="/privacy/requests/{params.id}">{COPY.backLink}</a>
  </Stack>
</Container>
