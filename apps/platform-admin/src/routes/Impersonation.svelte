<script lang="ts">
import {
  ApiError,
  createImpersonation,
  listImpersonations,
  revokeImpersonation,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import {
  Alert,
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

// `$derived`, not a plain const — the labels go through `t`, so a locale
// switch has to rebuild the options the mode select displays.
const MODE_OPTIONS = $derived([
  { value: 'read_only', label: t['platform.impersonation.readOnly']() },
  { value: 'read_write', label: t['platform.impersonation.readWrite']() },
])

let grants = $state<GrantRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    grants = await listImpersonations(apiClient)
  } catch {
    error = t['platform.impersonation.errorMessage']()
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
  return ms <= 0
    ? t['platform.impersonation.expired']()
    : t['platform.impersonation.minutesRemaining']({ count: Math.ceil(ms / 60_000) })
}

let startOpen = $state(false)
let startTenantId = $state('')
let startTargetUserId = $state('')
let startReason = $state('')
let startDuration = $state('30')
let startMode = $state<'read_only' | 'read_write'>('read_only')
let starting = $state(false)

// `Number("abc")` is NaN and JSON.stringify serializes NaN as null — the
// backend would receive a nonsense duration. Validate before submit.
const startDurationInvalid = $derived.by(() => {
  const trimmed = startDuration.trim()
  if (trimmed === '') return false // empty is caught by the disabled submit button
  const parsed = Number(trimmed)
  return !Number.isSafeInteger(parsed) || parsed < 1
})

function openStart(): void {
  startTenantId = ''
  startTargetUserId = ''
  startReason = ''
  startDuration = '30'
  startMode = 'read_only'
  startOpen = true
}

async function handleStart(): Promise<void> {
  if (startDurationInvalid) return
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
    showToast({ variant: 'success', title: t['platform.impersonation.started']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.impersonation.startError'](),
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
    showToast({ variant: 'success', title: t['platform.impersonation.revoked']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.impersonation.revokeError'](),
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
      <h1>{t['platform.impersonation.title']()}</h1>
      <p>{t['platform.impersonation.description']()}</p>
    </div>
    <Button onclick={openStart}>{t['platform.impersonation.start']()}</Button>
  </div>

  {#if loading}
    <p>{t['common.loading']()}</p>
  {:else if error}
    <p role="alert">{error}</p>
  {:else}
    <section>
      <h2>{t['platform.impersonation.activeTitle']()}</h2>
      {#if activeGrants.length === 0}
        <p class="sanvi-impersonation__empty">{t['platform.impersonation.noActive']()}</p>
      {:else}
        <table class="sanvi-impersonation__table">
          <thead>
            <tr>
              <th scope="col">{t['platform.impersonation.tenantHeader']()}</th>
              <th scope="col">{t['platform.impersonation.targetHeader']()}</th>
              <th scope="col">{t['platform.impersonation.modeHeader']()}</th>
              <th scope="col">{t['platform.impersonation.reasonHeader']()}</th>
              <th scope="col">{t['platform.impersonation.remainingHeader']()}</th>
              <th scope="col"><span class="sanvi-visually-hidden">{t['platform.impersonation.revoke']()}</span></th>
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
                  <Button variant="ghost" size="sm" onclick={() => openRevoke(grant)}>{t['platform.impersonation.revoke']()}</Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section>
      <h2>{t['platform.impersonation.pastTitle']()}</h2>
      {#if pastGrants.length === 0}
        <p class="sanvi-impersonation__empty">{t['platform.impersonation.noPast']()}</p>
      {:else}
        <table class="sanvi-impersonation__table">
          <thead>
            <tr>
              <th scope="col">{t['platform.impersonation.tenantHeader']()}</th>
              <th scope="col">{t['platform.impersonation.targetHeader']()}</th>
              <th scope="col">{t['platform.impersonation.modeHeader']()}</th>
              <th scope="col">{t['platform.impersonation.reasonHeader']()}</th>
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

<Dialog bind:open={startOpen} titleText={t['platform.impersonation.startTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.impersonation.tenantIdLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startTenantId} required />
        {/snippet}
      </Field>
      <Field label={t['platform.impersonation.targetUserIdLabel']()} hint={t['platform.impersonation.targetUserIdHint']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startTargetUserId} required />
        {/snippet}
      </Field>
      <Field label={t['platform.impersonation.reasonLabel']()} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={startReason} required />
        {/snippet}
      </Field>
      <Field label={t['platform.impersonation.durationLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={startDuration} required />
        {/snippet}
      </Field>
      {#if startDurationInvalid}
        <Alert variant="error">{t['platform.impersonation.durationInvalid']()}</Alert>
      {/if}
      <Field label={t['platform.impersonation.modeLabel']()} required>
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
    <Button variant="ghost" onclick={() => (startOpen = false)}>{t['platform.impersonation.cancel']()}</Button>
    <Button
      disabled={
        !startTenantId.trim() ||
        !startTargetUserId.trim() ||
        !startReason.trim() ||
        !startDuration.trim() ||
        startDurationInvalid
      }
      loading={starting}
      onclick={handleStart}
    >
      {t['platform.impersonation.submit']()}
    </Button>
  {/snippet}
</Dialog>

{#if revokeTarget}
  <DangerousAction
    bind:open={revokeOpen}
    titleText={t['platform.impersonation.revokeTitle']()}
    consequence={t['platform.impersonation.revokeConsequence']()}
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
