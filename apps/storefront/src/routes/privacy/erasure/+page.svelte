<script lang="ts">
import {
  Alert,
  Button,
  Container,
  Field,
  Input,
  Spinner,
  Stack,
  Table,
  type TableColumn,
} from '@sanvi/ui'
import type { components } from '@sanvi/api-client'
import { submitDsr } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import type { PageData } from './$types'

/**
 * Erasure gets its own screen — not one click from a nav item — because it
 * must be honest about what is retained (invoices, for instance) rather
 * than promising total deletion. The retention table comes from the
 * backend's notice, the same rows the privacy notice renders.
 */
export const ssr = false

type RetentionRow = components['schemas']['RetentionNoticeRow']

let { data }: { data: PageData } = $props()

const COPY = {
  title: 'Erasing your data',
  intro:
    'Erasure removes your personal data from this storefront. It is a real request with real consequences, so this page explains what happens before you confirm.',
  willBeDeletedTitle: 'What is deleted',
  willBeDeletedBody:
    'Your profile, contact details, preferences, consents and non-transactional history are erased or anonymised so they can no longer be linked to you.',
  retainedTitle: 'What is kept, and why',
  retainedBody:
    'Some records are retained because the law requires it — invoices for tax, for example, or records of consent so we can prove what you chose. Everything below is kept only for the listed period.',
  retainedCategory: 'Category',
  retainedPeriod: 'Kept for',
  retainedAfter: 'After that',
  periodDays: (n: number) => `${n} days`,
  coolingTitle: 'Cooling-off window',
  coolingBody:
    'After you submit, a short cooling-off window opens. You can cancel from your request status page during it; after it closes, deletion runs and cannot be undone.',
  breaksTitle: 'What breaks',
  breaksBody:
    'Orders can no longer be traced to you, saved preferences disappear, and an account with this email cannot be recovered afterwards. Sign-in with this account stops working.',
  confirmLabel: 'Type ERASE to confirm',
  confirmKeyword: 'ERASE',
  emailLabel: 'Your email address',
  submit: 'Submit erasure request',
  busy: 'Submitting…',
  successTitle: 'Erasure request submitted',
  successBody: 'Check the request status page for its progress and the cooling-off window.',
  requestLink: 'Open your request',
  unavailableTitle: 'Privacy service unavailable',
  unavailableBody: 'Erasure cannot be submitted right now. Nothing is deleted by a failed request.',
  backLink: 'Back to your privacy overview',
  errorBody: 'The request could not be submitted. Check the details and try again.',
}

const privacy = $derived(data.privacy)
const session = $derived(data.session)

const retentionRows = $derived(privacy?.notice?.retention ?? [])
const retentionColumns: TableColumn<RetentionRow>[] = [
  { key: 'category', header: COPY.retainedCategory },
  { key: 'period_days', header: COPY.retainedPeriod },
  { key: 'action', header: COPY.retainedAfter },
]

let confirmation = $state('')
let email = $state('')
let submitting = $state(false)
let failed = $state(false)
let requestId = $state<string | null>(null)

const confirmationValid = $derived(confirmation.trim() === COPY.confirmKeyword)
const emailInvalid = $derived(!session && email.trim().length === 0)

async function submit(): Promise<void> {
  if (submitting || !confirmationValid || emailInvalid) return
  submitting = true
  failed = false
  try {
    const result = await submitDsr(apiClient, {
      kind: 'erasure',
      requester: 'subject',
      subject: {
        kind: session ? 'tenant_user' : 'contact',
        ...(email ? { email } : {}),
        evidence: [],
      },
    })
    requestId = result.request_id
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

    {#if !privacy}
      <Alert variant="warning" title={COPY.unavailableTitle}>{COPY.unavailableBody}</Alert>
      <a href="/privacy">{COPY.backLink}</a>
    {:else if requestId}
      <Alert variant="success" title={COPY.successTitle}>{COPY.successBody}</Alert>
      <a href="/privacy/requests/{requestId}">{COPY.requestLink}</a>
    {:else}
      <section aria-labelledby="sanvi-deleted">
        <h2 id="sanvi-deleted">{COPY.willBeDeletedTitle}</h2>
        <p>{COPY.willBeDeletedBody}</p>
      </section>

      <section aria-labelledby="sanvi-retained">
        <h2 id="sanvi-retained">{COPY.retainedTitle}</h2>
        <p>{COPY.retainedBody}</p>
        {#if retentionRows.length > 0}
          <Table rows={retentionRows} getRowId={(row) => row.category} caption={COPY.retainedTitle} columns={retentionColumns} />
        {/if}
      </section>

      <section aria-labelledby="sanvi-cooling">
        <h2 id="sanvi-cooling">{COPY.coolingTitle}</h2>
        <p>{COPY.coolingBody}</p>
      </section>

      <section aria-labelledby="sanvi-breaks">
        <h2 id="sanvi-breaks">{COPY.breaksTitle}</h2>
        <p>{COPY.breaksBody}</p>
      </section>

      <Stack>
        {#if !session}
          <Field label={COPY.emailLabel} required>
            {#snippet children({ id })}
              <Input {id} type="email" bind:value={email} />
            {/snippet}
          </Field>
        {/if}
        <Field label={COPY.confirmLabel} required>
          {#snippet children({ id })}
            <Input {id} bind:value={confirmation} />
          {/snippet}
        </Field>
        {#if failed}
          <Alert variant="error">{COPY.errorBody}</Alert>
        {/if}
        <div>
          {#if submitting}
            <Spinner label={COPY.busy} />
          {:else}
            <Button onclick={submit} disabled={!confirmationValid || emailInvalid}>
              {COPY.submit}
            </Button>
          {/if}
        </div>
      </Stack>
      <a href="/privacy">{COPY.backLink}</a>
    {/if}
  </Stack>
</Container>
