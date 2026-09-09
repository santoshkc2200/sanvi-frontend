<script lang="ts">
import { can } from '@sanvi/auth'
import {
  ApiError,
  createAdAudience,
  listAdAudiences,
  listAdConnections,
  listAdPlatforms,
  refreshAdAudience,
} from '@sanvi/api-client'
import type { Audience } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  Container,
  DataTable,
  EmptyState,
  Field,
  Input,
  NO_VALUE,
  Select,
  Spinner,
  Stack,
  UpgradePrompt,
  humanizeOptionValue,
  showToast,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'

/**
 * The audience-management screen (phase 10, TASK-015 / slice 10.6).
 *
 * One statement governs everything here, and it renders *before* any build
 * or refresh control: subjects who opted out are excluded at build time and
 * removed from an existing audience on refresh — one-way. A refresh is not
 * a neutral "update"; it is a compliance action, and the screen says so
 * before the first button rather than after the first surprise.
 *
 * Members are stored server-side as hashes; the screen renders counts and
 * the hash values — never raw contact details, and no export of them.
 */
let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let trackingEnabled = $state(true)
let audiences = $state<Audience[]>([])
let platformNames = $state<Record<string, string>>({})
let connectedPlatforms = $state<{ key: string; label: string }[]>([])

let newName = $state('')
let newPlatform = $state('')
let saving = $state(false)
let refreshingId = $state<string | null>(null)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  audiences = []
  connectedPlatforms = []
  trackingEnabled = hasFeature('advertising.conversion_tracking')

  try {
    const [list, connections, catalog] = await Promise.all([
      listAdAudiences(apiClient),
      listAdConnections(apiClient).catch(() => undefined),
      listAdPlatforms(apiClient).catch(() => undefined),
    ])
    if (seq !== loadSeq) return
    audiences = list ?? []
    const names: Record<string, string> = {}
    for (const platform of catalog?.platforms ?? []) {
      names[platform.key] = platform.display_name
    }
    platformNames = names
    connectedPlatforms = (connections?.connections ?? [])
      .filter((connection) => connection.status === 'active')
      .map((connection) => ({
        key: connection.platform,
        label:
          connection.account_name ??
          names[connection.platform] ??
          humanizeOptionValue(connection.platform),
      }))
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
  } finally {
    if (seq === loadSeq) loading = false
  }
}

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))

function platformLabel(key: string): string {
  return platformNames[key] ?? humanizeOptionValue(key)
}

function statusLabel(audience: Audience): string {
  if (audience.status.status === 'building') {
    return t['admin.advertising.audiences.status.building']()
  }
  if (audience.status.status === 'active') {
    return t['admin.advertising.audiences.status.active']()
  }
  return t['admin.advertising.audiences.status.failed']()
}

function statusTone(audience: Audience): 'neutral' | 'success' | 'error' {
  if (audience.status.status === 'building') return 'neutral'
  if (audience.status.status === 'active') return 'success'
  return 'error'
}

async function build(): Promise<void> {
  if (!newPlatform || !newName.trim()) return
  saving = true
  try {
    const created = await createAdAudience(apiClient, {
      name: newName.trim(),
      platform: newPlatform,
    })
    audiences = [created, ...audiences]
    newName = ''
    newPlatform = ''
    showToast({
      title: t['admin.advertising.audiences.buildSuccessToast'](),
      variant: 'success',
    })
  } catch {
    showToast({
      title: t['admin.advertising.audiences.buildErrorToast'](),
      variant: 'error',
    })
  } finally {
    saving = false
  }
}

async function refresh(audience: Audience): Promise<void> {
  refreshingId = audience.id
  try {
    const updated = await refreshAdAudience(apiClient, audience.id)
    audiences = audiences.map((candidate) => (candidate.id === updated.id ? updated : candidate))
    showToast({
      title: t['admin.advertising.audiences.refreshSuccessToast'](),
      variant: 'success',
    })
  } catch {
    showToast({
      title: t['admin.advertising.audiences.refreshErrorToast'](),
      variant: 'error',
    })
  } finally {
    refreshingId = null
  }
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

{#snippet platformCell(row: Audience)}
  {platformLabel(row.platform)}
{/snippet}

{#snippet statusCell(row: Audience)}
  <Stack gap="1">
    <Badge variant={statusTone(row)}>{statusLabel(row)}</Badge>
    {#if row.status.status === 'failed'}
      <span class="audiences__status-reason">
        {t['admin.advertising.audiences.status.failedReason']({ reason: row.status.reason })}
      </span>
    {/if}
  </Stack>
{/snippet}

{#snippet sizeCell(row: Audience)}
  <Stack gap="1">
    <span>{fmt.number(row.included_identifiers.length)}</span>
    {#if row.included_identifiers.length > 0}
      <details class="audiences__identifiers">
        <summary>
          {t['admin.advertising.audiences.identifiersSummary']({
            count: fmt.number(row.included_identifiers.length),
          })}
        </summary>
        <ul class="audiences__hash-list">
          {#each row.included_identifiers as hash (hash)}
            <li>{hash}</li>
          {/each}
        </ul>
      </details>
    {/if}
    <span class="audiences__status-reason">
      {t['admin.advertising.audiences.sizeNote']()}
    </span>
  </Stack>
{/snippet}

{#snippet syncedCell(row: Audience)}
  {#if row.last_synced_at}
    {fmt.datetime(new Date(row.last_synced_at))}
  {:else}
    {t['admin.advertising.audiences.neverSynced']()}
  {/if}
{/snippet}

{#snippet actionsCell(row: Audience)}
  {#if writable && trackingEnabled}
    <Cluster gap="2">
      <Button
        variant="secondary"
        size="sm"
        disabled={refreshingId === row.id}
        onclick={() => void refresh(row)}
      >
        {refreshingId === row.id
          ? t['admin.advertising.audiences.refreshing']()
          : t['admin.advertising.audiences.refreshLabel']()}
        <span class="sanvi-visually-hidden">: {row.name}</span>
      </Button>
    </Cluster>
  {:else}
    {NO_VALUE}
  {/if}
{/snippet}

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.audiences.title']()}</h1>
      <p>{t['admin.advertising.audiences.description']()}</p>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={() => void load()}>
          {t['common.retry']()}
        </Button>
      </Alert>
    {/if}

    {#if loading}
      <Spinner label={t['admin.advertising.loading']()} />
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      <Alert variant="warning">
        <p>{t['admin.advertising.audiences.optOutTitle']()}</p>
        <p>{t['admin.advertising.audiences.optOutBody']()}</p>
      </Alert>

      {#if !trackingEnabled}
        <Alert variant="warning">
          <p>{t['admin.advertising.audiences.pausedTitle']()}</p>
          <p>{t['admin.advertising.audiences.pausedBody']()}</p>
        </Alert>
      {/if}

      <section aria-labelledby="audiences-build-heading">
        <Stack gap="4">
          <h2 id="audiences-build-heading">
            {t['admin.advertising.audiences.buildHeading']()}
          </h2>
          {#if connectedPlatforms.length === 0}
            <EmptyState
              title={t['admin.advertising.audiences.buildHeading']()}
              description={t['admin.advertising.audiences.noPlatformsBody']()}
            />
          {:else}
            <form
              class="audiences-build-form"
              onsubmit={(event) => {
                event.preventDefault()
                void build()
              }}
            >
              <Stack gap="4">
                <Field label={t['admin.advertising.audiences.buildNameLabel']()} required>
                  {#snippet children(controlProps)}
                    <Input {...controlProps} bind:value={newName} required />
                  {/snippet}
                </Field>
                <Field label={t['admin.advertising.audiences.buildPlatformLabel']()} required>
                  {#snippet children(controlProps)}
                    <Select
                      {...controlProps}
                      bind:value={newPlatform}
                      required
                      options={connectedPlatforms.map((platform) => ({
                        value: platform.key,
                        label: platform.label,
                      }))}
                    />
                  {/snippet}
                </Field>
                <div>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving
                      ? t['admin.advertising.audiences.buildSaving']()
                      : t['admin.advertising.audiences.buildSubmit']()}
                  </Button>
                </div>
              </Stack>
            </form>
          {/if}
        </Stack>
      </section>

      {#if audiences.length === 0}
        <EmptyState
          title={t['admin.advertising.audiences.emptyTitle']()}
          description={t['admin.advertising.audiences.emptyBody']()}
        />
      {:else}
        <DataTable
          columns={[
            {
              key: 'name',
              header: t['admin.advertising.audiences.columnName'](),
            },
            {
              key: 'platform',
              header: t['admin.advertising.audiences.columnPlatform'](),
              cell: platformCell,
            },
            {
              key: 'status',
              header: t['admin.advertising.audiences.columnStatus'](),
              cell: statusCell,
            },
            {
              key: 'included_identifiers',
              header: t['admin.advertising.audiences.columnSize'](),
              cell: sizeCell,
            },
            {
              key: 'last_synced_at',
              header: t['admin.advertising.audiences.columnSynced'](),
              cell: syncedCell,
            },
            {
              key: 'actions',
              header: t['admin.advertising.audiences.columnActions'](),
              cell: actionsCell,
            },
          ]}
          rows={audiences}
          getRowId={(row) => row.id}
          caption={t['admin.advertising.audiences.caption']()}
        />
      {/if}
    {/if}
  </Stack>
</Container>

<style>
  .audiences-build-form {
    max-width: var(--sanvi-spacing-48);
  }

  .audiences__status-reason {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .audiences__identifiers summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .audiences__hash-list {
    margin: var(--sanvi-spacing-1) 0 0;
    padding-left: var(--sanvi-spacing-6);
    font-family: var(--sanvi-font-family-mono);
    font-size: var(--sanvi-font-size-xs);
    word-break: break-all;
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
