<script lang="ts">
import { t, normalizeEmail } from '@sanvi/i18n'
import { Alert, Button, Container, Field, Input, Select, Spinner, Stack, Textarea } from '@sanvi/ui'
import { submitDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'
import { localePath } from '$lib/links'

/**
 * Authorized-agent submission — a distinct path that collects the agent's
 * details and the authorisation evidence, and says plainly that the
 * consumer will still be asked to verify. The upload itself is a reference
 * to a scanned document handled out of band in this phase; the API takes an
 * opaque evidence reference, not a file.
 */
export const ssr = false

type SubmitDsrOutput = components['schemas']['SubmitDsrOutput']

const COPY = $derived({
  title: t['privacy.agent.title'](),
  intro: t['privacy.agent.intro'](),
  agentNameLabel: t['privacy.agent.agentNameLabel'](),
  agentContactLabel: t['privacy.agent.agentContactLabel'](),
  subjectEmailLabel: t['privacy.agent.subjectEmailLabel'](),
  kindLabel: t['privacy.agent.kindLabel'](),
  kindOptions: [
    { value: 'access', label: t['privacy.agent.kindAccess']() },
    { value: 'export', label: t['privacy.agent.kindExport']() },
    { value: 'erasure', label: t['privacy.agent.kindErasure']() },
    { value: 'opt_out_sale_or_share', label: t['privacy.agent.kindOptOut']() },
  ],
  evidenceKindLabel: t['privacy.agent.evidenceKindLabel'](),
  evidenceKindOptions: [
    { value: 'written_permission', label: t['privacy.agent.evidenceWrittenPermission']() },
    { value: 'power_of_attorney', label: t['privacy.agent.evidencePowerOfAttorney']() },
    { value: 'guardian', label: t['privacy.agent.evidenceGuardian']() },
  ],
  evidenceReferenceLabel: t['privacy.agent.evidenceReferenceLabel'](),
  evidenceHint: t['privacy.agent.evidenceHint'](),
  noteLabel: t['privacy.agent.noteLabel'](),
  statement: t['privacy.agent.statement'](),
  submit: t['privacy.agent.submit'](),
  busy: t['privacy.agent.busy'](),
  successTitle: t['privacy.agent.successTitle'](),
  receivedLabel: t['privacy.agent.receivedLabel'](),
  dueLabel: t['privacy.agent.dueLabel'](),
  unavailableTitle: t['privacy.agent.unavailableTitle'](),
  unavailableBody: t['privacy.agent.unavailableBody'](),
  trackLink: t['privacy.requests.trackLink'](),
  backLink: t['privacy.overview.backLink'](),
  errorBody: t['privacy.agent.errorBody'](),
})

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
      // NFKC-normalised for the backend match (full-width IME output); the
      // inputs keep the raw text for display.
      subject: { kind: 'end_user', email: normalizeEmail(subjectEmail), evidence: [] },
      agent: {
        agent_name: agentName,
        agent_contact: { email: normalizeEmail(agentContact) },
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
          <a href={localePath(`/privacy/requests/${result.request_id}`)}>{COPY.trackLink}</a>
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
    <a href={localePath('/privacy')}>{COPY.backLink}</a>
  </Stack>
</Container>
