<script lang="ts">
import {
  ApiError,
  createImpersonation,
  listImpersonations,
  revokeImpersonation,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import {
  Badge,
  Button,
  DangerousAction,
  Dialog,
  Field,
  Input,
  Select,
  Stack,
  Textarea,
  showToast,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type GrantRow = components['schemas']['ImpersonationGrantView']

const COPY = {
  title: 'Impersonation',
  description: 'Time-boxed, audited support access into a tenant.',
  start: 'Start impersonation',
  activeTitle: 'Active',
  pastTitle: 'Past',
  noActive: 'No active impersonation grants.',
  noPast: 'No past grants.',
  loading: 'Loading',
  errorMessage: 'Could not load impersonation grants.',
  tenantHeader: 'Tenant',
  targetHeader: 'Target user',
  modeHeader: 'Mode',
  reasonHeader: 'Reason',
  remainingHeader: 'Remaining',
  revoke: 'Force end',
  revokeTitle: 'End this impersonation grant',
  revokeConsequence: 'The impersonated session is terminated immediately.',
  revoked: 'Grant revoked.',
  revokeError: 'Could not revoke this grant.',
  startTitle: 'Start impersonation',
  tenantIdLabel: 'Tenant id',
  targetUserIdLabel: 'Target user id',
  targetUserIdHint:
    'From the member list or a support ticket — there is no in-console member picker yet.',
  reasonLabel: 'Reason',
  durationLabel: 'Duration (minutes)',
  modeLabel: 'Mode',
  readOnly: 'Read-only',
  readWrite: 'Read-write',
  cancel: 'Cancel',
  submit: 'Start',
  started: 'Impersonation grant created.',
  startError: 'Could not create the impersonation grant.',
  minutesRemaining: (n: number) => `${n} min`,
  expired: 'Expired',
}

const MODE_OPTIONS = [
  { value: 'read_only', label: COPY.readOnly },
  { value: 'read_write', label: COPY.readWrite },
]

let grants = $state<GrantRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    grants = await listImpersonations(apiClient)
  } catch {
    error = COPY.errorMessage
  } finally {
    loading = false
  }
}

$effect(() => {
  void load()
})

function isActive(grant: GrantRow): boolean {
  return !grant.revoked_at && new Date(grant.expires_at).getTime() > Date.now()
}

const activeGrants = $derived(grants.filter(isActive))
const pastGrants = $derived(grants.filter((grant) => !isActive(grant)))

function minutesRemaining(grant: GrantRow): string {
  const ms = new Date(grant.expires_at).getTime() - Date.now()
  return ms <= 0 ? COPY.expired : COPY.minutesRemaining(Math.ceil(ms / 60_000))
}

let startOpen = $state(false)
let startTenantId = $state('')
let startTargetUserId = $state('')
let startReason = $state('')
let startDuration = $state('30')
let startMode = $state<'read_only' | 'read_write'>('read_only')
let starting = $state(false)

function openStart(): void {
  startTenantId = ''
  startTargetUserId = ''
  startReason = ''
  startDuration = '30'
  startMode = 'read_only'
  startOpen = true
}

async function handleStart(): Promise<void> {
  starting = true
  try {
    await createImpersonation(apiClient, {
      tenant_id: startTenantId,
      target_user_id: startTargetUserId,
      reason: startReason,
      duration_minutes: Number(startDuration),
      mode: startMode,
    })
    startOpen = false
    showToast({ variant: 'success', title: COPY.started })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.startError,
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    starting = false
  }
}

let revokeTarget = $state<GrantRow | undefined>(undefined)
let revokeOpen = $state(false)
let revoking = $state(false)

function openRevoke(grant: GrantRow): void {
  revokeTarget = grant
  revokeOpen = true
}

async function handleRevoke(): Promise<void> {
  if (!revokeTarget) return
  revoking = true
  try {
    await revokeImpersonation(apiClient, revokeTarget.id)
    revokeOpen = false
    showToast({ variant: 'success', title: COPY.revoked })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.revokeError,
      description: err instanceof ApiError ? err.detail : undefined,
    })
  } finally {
    revoking = false
  }
}
</script>

<Stack gap="6">
  <div class="sanvi-impersonation__header">
    <div>
      <h1>{COPY.title}</h1>
      <p>{COPY.description}</p>
    </div>
    <Button onclick={openStart}>{COPY.start}</Button>
  </div>

  {#if loading}
    <p>{COPY.loading}</p>
  {:else if error}
    <p role="alert">{error}</p>
  {:else}
    <section>
      <h2>{COPY.activeTitle}</h2>
      {#if activeGrants.length === 0}
        <p class="sanvi-impersonation__empty">{COPY.noActive}</p>
      {:else}
        <table class="sanvi-impersonation__table">
          <thead>
            <tr>
              <th scope="col">{COPY.tenantHeader}</th>
              <th scope="col">{COPY.targetHeader}</th>
              <th scope="col">{COPY.modeHeader}</th>
              <th scope="col">{COPY.reasonHeader}</th>
              <th scope="col">{COPY.remainingHeader}</th>
              <th scope="col"><span class="sanvi-visually-hidden">{COPY.revoke}</span></th>
            </tr>
          </thead>
          <tbody>
            {#each activeGrants as grant (grant.id)}
              <tr>
                <td>{grant.tenant_id}</td>
                <td>{grant.target_user_id}</td>
                <td><Badge variant={grant.mode === 'read_write' ? 'warning' : 'neutral'}>{grant.mode}</Badge></td>
                <td>{grant.reason}</td>
                <td>{minutesRemaining(grant)}</td>
                <td>
                  <Button variant="ghost" size="sm" onclick={() => openRevoke(grant)}>{COPY.revoke}</Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section>
      <h2>{COPY.pastTitle}</h2>
      {#if pastGrants.length === 0}
        <p class="sanvi-impersonation__empty">{COPY.noPast}</p>
      {:else}
        <table class="sanvi-impersonation__table">
          <thead>
            <tr>
              <th scope="col">{COPY.tenantHeader}</th>
              <th scope="col">{COPY.targetHeader}</th>
              <th scope="col">{COPY.modeHeader}</th>
              <th scope="col">{COPY.reasonHeader}</th>
            </tr>
          </thead>
          <tbody>
            {#each pastGrants as grant (grant.id)}
              <tr>
                <td>{grant.tenant_id}</td>
                <td>{grant.target_user_id}</td>
                <td><Badge variant="neutral">{grant.mode}</Badge></td>
                <td>{grant.reason}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/if}
</Stack>

<Dialog bind:open={startOpen} titleText={COPY.startTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.tenantIdLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startTenantId} required />
        {/snippet}
      </Field>
      <Field label={COPY.targetUserIdLabel} hint={COPY.targetUserIdHint} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startTargetUserId} required />
        {/snippet}
      </Field>
      <Field label={COPY.reasonLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={startReason} required />
        {/snippet}
      </Field>
      <Field label={COPY.durationLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startDuration} required />
        {/snippet}
      </Field>
      <Field label={COPY.modeLabel} required>
        {#snippet children({ id })}
          <Select
            {id}
            value={startMode}
            options={MODE_OPTIONS}
            onchange={(event) => (startMode = event.currentTarget.value as 'read_only' | 'read_write')}
          />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (startOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={!startTenantId.trim() || !startTargetUserId.trim() || !startReason.trim() || !startDuration.trim()}
      loading={starting}
      onclick={handleStart}
    >
      {COPY.submit}
    </Button>
  {/snippet}
</Dialog>

{#if revokeTarget}
  <DangerousAction
    bind:open={revokeOpen}
    titleText={COPY.revokeTitle}
    consequence={COPY.revokeConsequence}
    submitting={revoking}
    onConfirm={handleRevoke}
  />
{/if}

<style>
  .sanvi-impersonation__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
  }

  .sanvi-impersonation__empty {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-impersonation__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-impersonation__table th,
  .sanvi-impersonation__table td {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    text-align: start;
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
