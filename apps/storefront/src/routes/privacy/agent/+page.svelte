<script lang="ts">
import { Alert, Button, Container, Field, Input, Select, Spinner, Stack, Textarea } from '@sanvi/ui'
import { submitDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'

/**
 * Authorized-agent submission — a distinct path that collects the agent's
 * details and the authorisation evidence, and says plainly that the
 * consumer will still be asked to verify. The upload itself is a reference
 * to a scanned document handled out of band in this phase; the API takes an
 * opaque evidence reference, not a file.
 */
export const ssr = false

type SubmitDsrOutput = components['schemas']['SubmitDsrOutput']

const COPY = {
  title: 'Submit as an authorized agent',
  intro:
    "You can submit a privacy request on someone else's behalf if they authorized you in writing. This form records your authorisation — the consumer will still be asked to verify themselves before anything is disclosed.",
  agentNameLabel: 'Your full name',
  agentContactLabel: 'Your email address',
  subjectEmailLabel: "The consumer's email address",
  kindLabel: 'Request type',
  kindOptions: [
    { value: 'access', label: 'Access — see what data is held' },
    { value: 'export', label: 'Export — download a copy of the data' },
    { value: 'erasure', label: 'Erasure — delete the data' },
    { value: 'opt_out_sale_or_share', label: 'Opt out of sale or sharing' },
  ],
  evidenceKindLabel: 'Authorisation evidence type',
  evidenceKindOptions: [
    { value: 'written_permission', label: 'Written permission signed by the consumer' },
    { value: 'power_of_attorney', label: 'Power of attorney' },
    { value: 'guardian', label: 'Guardianship documentation' },
  ],
  evidenceReferenceLabel: 'Evidence reference',
  evidenceHint: 'The reference or file id of the scanned authorisation document you submitted.',
  noteLabel: 'Notes (optional)',
  statement:
    'The consumer will be asked to verify their identity directly before any data is disclosed or deleted.',
  submit: 'Submit as agent',
  busy: 'Submitting…',
  successTitle: 'Agent submission recorded',
  receivedLabel: 'Received',
  dueLabel: 'Expected completion by',
  unavailableTitle: 'Privacy service unavailable',
  unavailableBody: 'Agent submissions cannot be recorded right now. Please try again later.',
  trackLink: 'View the request status',
  backLink: 'Back to your privacy overview',
  errorBody: 'The submission could not be recorded. Check the details and try again.',
}

let agentName = $state('')
let agentContact = $state('')
let subjectEmail = $state('')
let kind = $state<string>('export')
let evidenceKind = $state<string>('written_permission')
let evidenceReference = $state('')
let note = $state('')
let submitting = $state(false)
let failed = $state(false)
let result = $state<SubmitDsrOutput | null>(null)

const valid = $derived(
  agentName.trim().length > 0 &&
    agentContact.trim().length > 0 &&
    subjectEmail.trim().length > 0 &&
    evidenceReference.trim().length > 0,
)

async function submit(): Promise<void> {
  if (submitting || !valid) return
  submitting = true
  failed = false
  try {
    result = await submitDsr(apiClient, {
      kind: kind as 'access',
      requester: 'authorized_agent',
      subject: { kind: 'end_user', email: subjectEmail, evidence: [] },
      agent: {
        agent_name: agentName,
        agent_contact: { email: agentContact },
        authorization_evidence: { kind: evidenceKind, value: evidenceReference },
      },
      ...(note ? { note } : {}),
    })
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
    <Alert variant="info">{COPY.statement}</Alert>

    {#if result}
      <Alert variant="success" title={COPY.successTitle}>
        <Stack>
          <span>{COPY.receivedLabel}: {formatDate(new Date().toISOString())}</span>
          <span>{COPY.dueLabel}: {formatDate(result.due_at)}</span>
          <a href="/privacy/requests/{result.request_id}">{COPY.trackLink}</a>
        </Stack>
      </Alert>
    {:else}
      <Stack>
        <Field label={COPY.agentNameLabel} required>
          {#snippet children({ id })}
            <Input {id} bind:value={agentName} />
          {/snippet}
        </Field>
        <Field label={COPY.agentContactLabel} required>
          {#snippet children({ id })}
            <Input {id} type="email" bind:value={agentContact} />
          {/snippet}
        </Field>
        <Field label={COPY.subjectEmailLabel} required>
          {#snippet children({ id })}
            <Input {id} type="email" bind:value={subjectEmail} />
          {/snippet}
        </Field>
        <Field label={COPY.kindLabel} required>
          {#snippet children({ id })}
            <Select {id} options={COPY.kindOptions} bind:value={kind} />
          {/snippet}
        </Field>
        <Field label={COPY.evidenceKindLabel} required>
          {#snippet children({ id })}
            <Select {id} options={COPY.evidenceKindOptions} bind:value={evidenceKind} />
          {/snippet}
        </Field>
        <Field label={COPY.evidenceReferenceLabel} hint={COPY.evidenceHint} required>
          {#snippet children({ id })}
            <Input {id} bind:value={evidenceReference} />
          {/snippet}
        </Field>
        <Field label={COPY.noteLabel}>
          {#snippet children({ id })}
            <Textarea {id} bind:value={note} />
          {/snippet}
        </Field>
        {#if failed}
          <Alert variant="error">{COPY.errorBody}</Alert>
        {/if}
        <div>
          {#if submitting}
            <Spinner label={COPY.busy} />
          {:else}
            <Button onclick={submit} disabled={!valid}>{COPY.submit}</Button>
          {/if}
        </div>
      </Stack>
    {/if}
    <a href="/privacy">{COPY.backLink}</a>
  </Stack>
</Container>
