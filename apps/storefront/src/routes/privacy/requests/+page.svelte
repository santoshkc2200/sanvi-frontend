<script lang="ts">
import { t, normalizeEmail } from '@sanvi/i18n'
import { Alert, Button, Container, Field, Input, Select, Spinner, Stack, Textarea } from '@sanvi/ui'
import { submitDsr, verifyDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { formatDate } from '$lib/format'
import { localePath } from '$lib/links'
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

const COPY = $derived({
  title: t['privacy.requests.title'](),
  intro: t['privacy.requests.intro'](),
  kindLabel: t['privacy.requests.kindLabel'](),
  kindOptions: [
    { value: 'access', label: t['privacy.requests.kindAccess']() },
    { value: 'export', label: t['privacy.requests.kindExport']() },
    { value: 'rectification', label: t['privacy.requests.kindRectification']() },
    { value: 'erasure', label: t['privacy.requests.kindErasure']() },
  ],
  emailLabel: t['privacy.requests.emailLabel'](),
  emailHint: t['privacy.requests.emailHint'](),
  noteLabel: t['privacy.requests.noteLabel'](),
  submit: t['privacy.requests.submit'](),
  busy: t['privacy.requests.busy'](),
  verifyTitle: t['privacy.requests.verifyTitle'](),
  verifyBody: (email: string) => t['privacy.requests.verifyBody']({ email }),
  codeLabel: t['privacy.requests.codeLabel'](),
  verify: t['privacy.requests.verify'](),
  verifying: t['privacy.requests.verifying'](),
  successTitle: t['privacy.requests.successTitle'](),
  receivedLabel: t['privacy.requests.receivedLabel'](),
  dueLabel: t['privacy.requests.dueLabel'](),
  jurisdictionLabel: t['privacy.requests.jurisdictionLabel'](),
  statusLabel: t['privacy.requests.statusLabel'](),
  trackTitle: t['privacy.requests.trackTitle'](),
  trackIntro: t['privacy.requests.trackIntro'](),
  trackIdLabel: t['privacy.requests.trackIdLabel'](),
  trackTokenLabel: t['privacy.requests.trackTokenLabel'](),
  trackButton: t['privacy.requests.trackButton'](),
  trackLink: t['privacy.requests.trackLink'](),
  backLink: t['privacy.overview.backLink'](),
  errorBody: t['privacy.requests.errorBody'](),
  verifyErrorBody: t['privacy.requests.verifyErrorBody'](),
})

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
        // NFKC-normalised for the backend match (full-width IME output); the
        // input keeps the raw text for display.
        ...(email ? { email: normalizeEmail(email) } : {}),
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
  window.location.assign(
    localePath(`/privacy/requests/${encodeURIComponent(trackId)}`) + tokenQuery,
  )
}
</script>

<svelte:head><title>{COPY.title}</title></svelte:head>

<Container>
  <Stack>
    <h1>{COPY.title}</h1>
    <p>{COPY.intro}</p>

    {#if submitted && (verified || !submitted.verification_required)}
      <Alert variant="success" title={COPY.successTitle}>
        <Stack>
          <span>{COPY.receivedLabel}: {formatDate(new Date().toISOString())}</span>
          <span>{COPY.dueLabel}: {formatDate(submitted.due_at)}</span>
          <span>{COPY.jurisdictionLabel}: {submitted.jurisdiction}</span>
          <span>{COPY.statusLabel}: {submitted.status}</span>
          <a href={localePath(`/privacy/requests/${submitted.request_id}`)}>{COPY.trackLink}</a>
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

    <a href={localePath('/privacy')}>{COPY.backLink}</a>
  </Stack>
</Container>
