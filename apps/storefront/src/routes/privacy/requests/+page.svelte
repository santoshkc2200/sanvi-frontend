<script lang="ts">
import { Alert, Button, Container, Field, Input, Select, Spinner, Stack, Textarea } from '@sanvi/ui'
import { submitDsr, verifyDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'
import type { PageData } from './$types'

/**
 * Self-service DSR submission. Signed-in requesters are verified by their
 * session; anonymous requesters get an email OTP. Opt-outs are deliberately
 * NOT here — they live on their own no-verification pages.
 */
export const ssr = false

let { data }: { data: PageData } = $props()

type SubmitDsrOutput = components['schemas']['SubmitDsrOutput']
type DsrKind = components['schemas']['DsrKind']

const COPY = {
  title: 'Your privacy requests',
  intro:
    'Ask for a copy, a correction or the erasure of your data. The deadline shown comes from the rules that apply to your jurisdiction, not from us.',
  kindLabel: 'What are you asking for?',
  kindOptions: [
    { value: 'access', label: 'Access — see what data we hold about you' },
    { value: 'export', label: 'Export — download a copy of your data' },
    { value: 'rectification', label: 'Rectification — correct wrong data' },
    { value: 'erasure', label: 'Erasure — delete my data (see the erasure page first)' },
  ],
  emailLabel: 'Your email address',
  emailHint: 'We send a one-time code to this address to verify it is you.',
  noteLabel: 'Anything we should know? (optional)',
  submit: 'Submit request',
  busy: 'Submitting…',
  verifyTitle: 'Check your email',
  verifyBody: (email: string) =>
    `We sent a one-time code to ${email}. Enter it below to confirm the request.`,
  codeLabel: 'One-time code',
  verify: 'Confirm request',
  verifying: 'Confirming…',
  successTitle: 'Request submitted',
  receivedLabel: 'Received',
  dueLabel: 'Expected completion by',
  jurisdictionLabel: 'Jurisdiction',
  statusLabel: 'Status',
  trackTitle: 'Track an existing request',
  trackIntro:
    'The request id is in the confirmation email. The token comes with the download link, if your request has one.',
  trackIdLabel: 'Request id',
  trackTokenLabel: 'Token (optional)',
  trackButton: 'Open request',
  trackLink: 'View the request status',
  backLink: 'Back to your privacy overview',
  errorBody: 'The request could not be submitted. Check the details and try again.',
  verifyErrorBody: 'That code was not accepted. Check the email and try again.',
}

const session = $derived(data.session)

let kind = $state<string>('export')
let email = $state('')
let note = $state('')
let submitting = $state(false)
let error = $state(false)

let submitted = $state<SubmitDsrOutput | null>(null)
let code = $state('')
let verifying = $state(false)
let verifyFailed = $state(false)
let verified = $state(false)

let trackId = $state('')
let trackToken = $state('')

const emailInvalid = $derived(!session && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))

async function submit(): Promise<void> {
  if (submitting || emailInvalid) return
  submitting = true
  error = false
  try {
    submitted = await submitDsr(apiClient, {
      kind: kind as DsrKind,
      requester: 'subject',
      subject: {
        kind: session ? 'tenant_user' : 'contact',
        ...(email ? { email } : {}),
        evidence: [],
      },
      ...(note ? { note } : {}),
    })
  } catch {
    error = true
  } finally {
    submitting = false
  }
}

async function verify(): Promise<void> {
  if (!submitted || verifying) return
  verifying = true
  verifyFailed = false
  try {
    await verifyDsr(apiClient, submitted.request_id, {
      code,
      token: submitted.challenge_id ?? '',
    })
    verified = true
  } catch {
    verifyFailed = true
  } finally {
    verifying = false
  }
}

function openTracked(): void {
  if (!trackId) return
  const tokenQuery = trackToken ? `?token=${encodeURIComponent(trackToken)}` : ''
  window.location.assign(`/privacy/requests/${encodeURIComponent(trackId)}${tokenQuery}`)
}
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if submitted && verified}
      <Alert variant="success" title={COPY.successTitle}>
        <Stack>
          <span>{COPY.receivedLabel}: {formatDate(new Date().toISOString())}</span>
          <span>{COPY.dueLabel}: {formatDate(submitted.due_at)}</span>
          <span>{COPY.jurisdictionLabel}: {submitted.jurisdiction}</span>
          <span>{COPY.statusLabel}: {submitted.status}</span>
          <a href="/privacy/requests/{submitted.request_id}">{COPY.trackLink}</a>
        </Stack>
      </Alert>
    {:else if submitted && submitted.verification_required}
      <Stack>
        <h2>{COPY.verifyTitle}</h2>
        <p>{COPY.verifyBody(email)}</p>
        <Field label={COPY.codeLabel} required>
          {#snippet children({ id })}
            <Input {id} bind:value={code} />
          {/snippet}
        </Field>
        {#if verifyFailed}
          <Alert variant="error">{COPY.verifyErrorBody}</Alert>
        {/if}
        <div>
          <Button onclick={verify} disabled={verifying || code.length === 0}>
            {verifying ? COPY.verifying : COPY.verify}
          </Button>
        </div>
      </Stack>
    {:else}
      <Stack>
        <Field label={COPY.kindLabel} required>
          {#snippet children({ id })}
            <Select {id} options={COPY.kindOptions} bind:value={kind} />
          {/snippet}
        </Field>
        {#if !session}
          <Field label={COPY.emailLabel} hint={COPY.emailHint} required error={email && emailInvalid ? COPY.emailHint : undefined}>
            {#snippet children({ id })}
              <Input {id} type="email" bind:value={email} />
            {/snippet}
          </Field>
        {/if}
        <Field label={COPY.noteLabel}>
          {#snippet children({ id })}
            <Textarea {id} bind:value={note} />
          {/snippet}
        </Field>
        {#if error}
          <Alert variant="error">{COPY.errorBody}</Alert>
        {/if}
        <div>
          {#if submitting}
            <Spinner label={COPY.busy} />
          {:else}
            <Button onclick={submit} disabled={submitting || emailInvalid}>
              {COPY.submit}
            </Button>
          {/if}
        </div>
      </Stack>
    {/if}

    <Stack>
      <h2>{COPY.trackTitle}</h2>
      <p>{COPY.trackIntro}</p>
      <Field label={COPY.trackIdLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={trackId} />
        {/snippet}
      </Field>
      <Field label={COPY.trackTokenLabel}>
        {#snippet children({ id })}
          <Input {id} bind:value={trackToken} />
        {/snippet}
      </Field>
      <div>
        <Button variant="secondary" onclick={openTracked} disabled={trackId.length === 0}>
          {COPY.trackButton}
        </Button>
      </div>
    </Stack>

    <a href="/privacy">{COPY.backLink}</a>
  </Stack>
</Container>
