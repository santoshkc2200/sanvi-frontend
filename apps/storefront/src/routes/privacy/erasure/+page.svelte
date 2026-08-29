<script lang="ts">
import { t, normalizeEmail } from '@sanvi/i18n'
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
import { localePath } from '$lib/links'
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

const COPY = $derived({
  title: t['privacy.erasure.title'](),
  intro: t['privacy.erasure.intro'](),
  willBeDeletedTitle: t['privacy.erasure.willBeDeletedTitle'](),
  willBeDeletedBody: t['privacy.erasure.willBeDeletedBody'](),
  retainedTitle: t['privacy.erasure.retainedTitle'](),
  retainedBody: t['privacy.erasure.retainedBody'](),
  retainedCategory: t['privacy.erasure.retainedCategory'](),
  retainedPeriod: t['privacy.erasure.retainedPeriod'](),
  retainedAfter: t['privacy.erasure.retainedAfter'](),
  periodDays: (n: number) => t['privacy.erasure.periodDays']({ count: n }),
  coolingTitle: t['privacy.erasure.coolingTitle'](),
  coolingBody: t['privacy.erasure.coolingBody'](),
  breaksTitle: t['privacy.erasure.breaksTitle'](),
  breaksBody: t['privacy.erasure.breaksBody'](),
  confirmLabel: t['privacy.erasure.confirmLabel'](),
  emailLabel: t['privacy.erasure.emailLabel'](),
  submit: t['privacy.erasure.submit'](),
  busy: t['privacy.erasure.busy'](),
  successTitle: t['privacy.erasure.successTitle'](),
  successBody: t['privacy.erasure.successBody'](),
  requestLink: t['privacy.erasure.requestLink'](),
  unavailableTitle: t['privacy.erasure.unavailableTitle'](),
  unavailableBody: t['privacy.erasure.unavailableBody'](),
  backLink: t['privacy.overview.backLink'](),
  errorBody: t['privacy.erasure.errorBody'](),
})

const privacy = $derived(data.privacy)
const session = $derived(data.session)

const retentionRows = $derived(privacy?.notice?.retention ?? [])
const retentionColumns: TableColumn<RetentionRow>[] = $derived([
  { key: 'category', header: COPY.retainedCategory },
  { key: 'period_days', header: COPY.retainedPeriod },
  { key: 'action', header: COPY.retainedAfter },
])

const CONFIRM_KEYWORD = 'ERASE'

let confirmation = $state('')
let email = $state('')
let submitting = $state(false)
let failed = $state(false)
let requestId = $state<string | null>(null)

const confirmationValid = $derived(confirmation.trim() === CONFIRM_KEYWORD)
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
        // NFKC-normalised for the backend match (full-width IME output); the
        // input keeps the raw text for display.
        ...(email ? { email: normalizeEmail(email) } : {}),
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
      <a href={localePath('/privacy')}>{COPY.backLink}</a>
    {:else if requestId}
      <Alert variant="success" title={COPY.successTitle}>{COPY.successBody}</Alert>
      <a href={localePath(`/privacy/requests/${requestId}`)}>{COPY.requestLink}</a>
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
      <a href={localePath('/privacy')}>{COPY.backLink}</a>
    {/if}
  </Stack>
</Container>
