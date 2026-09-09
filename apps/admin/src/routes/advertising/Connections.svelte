<script lang="ts">
import {
  ApiError,
  deleteAdConnection,
  listAdConnections,
  listAdPlatforms,
  startAdOAuth,
} from '@sanvi/api-client'
import type { ConnectionView, PlatformView } from '@sanvi/api-client'
import { hasFreshAal2, getSession } from '@sanvi/auth'
import { fmt, t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  AdConnectionHealth,
  AdPlatformCard,
  Alert,
  Button,
  Container,
  Dialog,
  EmptyState,
  Field,
  humanizeOptionValue,
  Input,
  showToast,
  Spinner,
  Stack,
  UpgradePrompt,
  adHealthState,
  type AdHealthLabels,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'

/**
 * The advertising connections screen (phase 10, TASK-011) — a credential
 * screen, because ad account access is money access. One card per catalog
 * platform (composing TASK-010's `AdPlatformCard`): the pre-connect state
 * explains what connecting allows, a connected platform shows its
 * server-computed health with the one action that fixes it, and a broken
 * one offers **re**-connect — visually and verbally distinct from a fresh
 * connect, because reconnecting the same account preserves its history
 * while picking a different account starts a new one.
 *
 * The OAuth handoff never touches a token or a client secret and never
 * builds an authorization URL: it POSTs the backend this app's own callback
 * route as `redirect_uri`, sends the browser to the returned URL verbatim,
 * and lets the callback route redeem `state`/`code`. The only freshness
 * logic client-side is `hasFreshAal2` — used to route to step-up *before*
 * a mutating call the backend would answer 403 anyway.
 *
 * With a platform flag off the catalog answers with `available: false` (and
 * `oauth/start` 503s); existing connections stay listed and keep rendering
 * their health — they are not presented as gone.
 */

let loading = $state(true)
let entitled = $state(true)
let error = $state<string | undefined>(undefined)
let platforms = $state<PlatformView[]>([])
let connections = $state<ConnectionView[]>([])
let connectionsError = $state<string | undefined>(undefined)

// OAuth start in flight (one at a time — each ends in a full-page redirect).
let startingPlatform = $state<string | undefined>(undefined)

// Disconnect dialog state.
let disconnectOpen = $state(false)
let disconnectTarget = $state<ConnectionView | null>(null)
let disconnectPhrase = $state('')
let disconnecting = $state(false)
let disconnectError = $state<string | undefined>(undefined)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  platforms = []
  connections = []
  connectionsError = undefined

  try {
    const catalog = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = catalog?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      // 403: no platform entitlement; 404: the advertising flag is off.
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
    loading = false
    return
  }

  try {
    const view = await listAdConnections(apiClient)
    if (seq !== loadSeq) return
    connections = view?.connections ?? []
  } catch {
    if (seq !== loadSeq) return
    // Health is freshness-sensitive, not a dead end: the catalog stays
    // usable, the failure is retriable above the list.
    connectionsError = t['admin.advertising.connectionsLoadError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

function retry(): void {
  void load()
}

function platformEntitled(platform: PlatformView): boolean {
  return platform.available && !platform.upgrade_required
}

function connectionFor(platform: PlatformView): ConnectionView | undefined {
  const matches = connections.filter((connection) => connection.platform === platform.key)
  if (matches.length === 0) return undefined
  matches.sort((a, b) => {
    if (a.status !== 'disconnected' && b.status === 'disconnected') return -1
    if (a.status === 'disconnected' && b.status !== 'disconnected') return 1
    return 0
  })
  return matches[0]
}

/** Per-platform entitlement labels for the card, keyed by connection state value. */
function connectionLabelFor(platform: PlatformView): string {
  return platform.connection_state === 'connected'
    ? t['admin.advertising.connectedBadge']()
    : t['admin.advertising.notConnectedBadge']()
}

/**
 * The one health state's message: what is wrong (or reassuringly right),
 * with the detail that distinguishes it — last sync time, expiry date, the
 * verbatim error, the missing scopes — plus, for the reconnect states, the
 * promise that reconnecting the same account preserves its history.
 */
function healthLabelsFor(connection: ConnectionView): AdHealthLabels {
  const health = connection.health
  const state = adHealthState(connection.status, health)
  const lastSynced = health.last_synced_at
    ? fmt.datetime(health.last_synced_at, 'medium')
    : t['admin.advertising.neverSynced']()

  switch (state) {
    case 'healthy':
      return {
        badge: t['admin.advertising.healthHealthyBadge'](),
        message: t['admin.advertising.healthHealthyMessage']({ time: lastSynced }),
      }
    case 'expiring': {
      const expires = health.token_expires_at ? fmt.date(health.token_expires_at, 'medium') : ''
      return {
        badge: t['admin.advertising.healthExpiringBadge'](),
        message: t['admin.advertising.healthExpiringMessage']({ date: expires }),
        actionLabel: t['admin.advertising.reconnectAction'](),
      }
    }
    case 'reconsent_required': {
      const scopeNames = health.scopes_missing.map(scopeDisplayName).join(', ')
      const stopped = !health.can_sync
        ? t['admin.advertising.reconsentSyncStopped']()
        : !health.can_upload_conversions
          ? t['admin.advertising.reconsentUploadsStopped']()
          : ''
      return {
        badge: t['admin.advertising.healthReconsentBadge'](),
        message: t['admin.advertising.healthReconsentMessage']({
          scopes: scopeNames,
          detail: stopped,
        }),
        actionLabel: t['admin.advertising.reconnectAction'](),
      }
    }
    case 'sync_failing': {
      return {
        badge: t['admin.advertising.healthSyncFailingBadge'](),
        message: t['admin.advertising.healthSyncFailingMessage']({
          detail: health.last_error ?? t['admin.advertising.syncErrorUnknown'](),
        }),
        actionLabel: t['admin.advertising.reconnectAction'](),
      }
    }
    case 'reconnect_required':
      return {
        badge: t['admin.advertising.healthReconnectBadge'](),
        message: t['admin.advertising.healthReconnectMessage'](),
        actionLabel: t['admin.advertising.reconnectAction'](),
      }
    case 'disconnected':
      return {
        badge: t['admin.advertising.healthDisconnectedBadge'](),
        message: t['admin.advertising.healthDisconnectedMessage'](),
      }
  }
}

/** True when this connection's fixing action is a reconnect (not a fresh connect). */
function isReconnectState(connection: ConnectionView): boolean {
  const state = adHealthState(connection.status, connection.health)
  return (
    state === 'reconnect_required' ||
    state === 'reconsent_required' ||
    state === 'sync_failing' ||
    state === 'expiring'
  )
}

/**
 * Localized display name for an OAuth scope, keyed by a slug of the scope
 * value itself — the same resolve-or-fallback pattern the matrix option
 * labels use, so a scope the catalogs have no entry for still renders (as
 * its own value) while its translation is on its way.
 */
function scopeDisplayName(scope: string): string {
  const tMap = t as unknown as Record<string, () => string>
  const key = `admin.advertising.scope.${scopeSlug(scope)}`
  return typeof tMap[key] === 'function' ? tMap[key]() : humanizeOptionValue(scope)
}

function scopeSlug(scope: string): string {
  let value = scope.trim().toLowerCase()
  if (value.startsWith('http')) {
    const parts = value.split('/').filter(Boolean)
    value = parts[parts.length - 1] ?? value
  }
  const slug = value.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return slug || 'scope'
}

// Freshness is read where it is used: opening (or confirming) a mutating
// action. Between those moments a session can lapse, so the confirm path
// re-checks.
function freshAal2(): boolean {
  return hasFreshAal2(getSession())
}

function stepUpReturnTo(query: string): string {
  return `/step-up?return_to=${encodeURIComponent(`/advertising/connections${query}`)}`
}

/**
 * The OAuth handoff: POST start, then send the browser to the backend's
 * authorization URL verbatim. A sanity check on the URL's protocol is the
 * one local guard — a non-http(s) value is refused, never navigated.
 */
async function connectFlow(platform: PlatformView): Promise<void> {
  if (startingPlatform) return
  if (!freshAal2()) {
    navigate(stepUpReturnTo(`?connect=${encodeURIComponent(platform.key)}`))
    return
  }

  startingPlatform = platform.key
  try {
    const redirectUri = `${window.location.origin}/advertising/connect/${platform.key}/callback`
    const started = await startAdOAuth(apiClient, platform.key, redirectUri)
    const target = new URL(started.authorization_url)
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      throw new Error('unsupported authorization URL protocol')
    }
    window.location.assign(target.toString())
  } catch (err) {
    startingPlatform = undefined
    if (err instanceof ApiError && err.status === 403) {
      if (!freshAal2()) {
        // Freshness lapsed mid-flight (or step-up was skipped) — route to
        // step-up and come straight back into this connect.
        navigate(stepUpReturnTo(`?connect=${encodeURIComponent(platform.key)}`))
        return
      }
      showToast({ title: t['admin.advertising.campaigns.forbidden'](), variant: 'error' })
      return
    }
    if (err instanceof ApiError && err.status === 503) {
      showToast({
        title: t['admin.advertising.platformUnavailableToast']({
          platform: platform.display_name,
        }),
        variant: 'warning',
      })
      return
    }
    showToast({ title: t['admin.advertising.connectStartError'](), variant: 'error' })
  }
}

function openDisconnect(connection: ConnectionView): void {
  disconnectTarget = connection
  disconnectPhrase = ''
  disconnectError = undefined
  disconnectOpen = true
}

function handleDisconnectRequested(): void {
  // The dialog's step-up leg: the operator asked to disconnect while the
  // session is stale — re-authenticate first, and the return_to brings
  // them back into this exact dialog.
  if (!disconnectTarget) return
  navigate(stepUpReturnTo(`?disconnect=${disconnectTarget.id}`))
}

async function handleDisconnectConfirm(): Promise<void> {
  const connection = disconnectTarget
  if (!connection || disconnecting) return
  if (disconnectPhrase.trim() !== 'DISCONNECT') return

  if (!freshAal2()) {
    // Freshness lapsed between opening the dialog and confirming — same
    // step-up path as the stale open.
    navigate(stepUpReturnTo(`?disconnect=${connection.id}`))
    return
  }

  disconnecting = true
  disconnectError = undefined
  try {
    await deleteAdConnection(apiClient, connection.id)
    disconnectOpen = false
    disconnectTarget = null
    showToast({ title: t['admin.advertising.disconnectSuccessToast'](), variant: 'success' })
    await load()
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      if (!freshAal2()) {
        disconnectOpen = false
        navigate(stepUpReturnTo(`?disconnect=${connection.id}`))
        return
      }
      disconnectError = t['admin.advertising.campaigns.forbidden']()
      return
    }
    disconnectError = t['admin.advertising.disconnectError']()
  } finally {
    disconnecting = false
  }
}

// The step-up round trip comes back to `?connect=<key>` / `?disconnect=<id>`
// on this route. Both resume exactly where the operator left off, then the
// URL is cleaned so a refresh never re-triggers the action.
$effect(() => {
  void getActiveTenantId()
  void load()
})

$effect(() => {
  if (loading || startingPlatform) return

  const query = new URLSearchParams(window.location.search)
  const connectKey = query.get('connect')
  const disconnectId = query.get('disconnect')
  if (!connectKey && !disconnectId) return

  window.history.replaceState(null, '', '/advertising/connections')

  if (connectKey) {
    const platform = platforms.find((candidate) => candidate.key === connectKey)
    if (platform && platformEntitled(platform)) void connectFlow(platform)
    return
  }

  if (disconnectId) {
    const connection = connections.find((candidate) => candidate.id === disconnectId)
    if (connection) openDisconnect(connection)
  }
})

const disconnectConsequence = $derived(
  disconnectTarget
    ? t['admin.advertising.disconnectAccountLabel']({
        account: disconnectTarget.account_name ?? disconnectTarget.external_account_id,
      })
    : '',
)
</script>

<svelte:head>
  <title>{t['admin.advertising.connectionsTitle']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.connectionsTitle']()}</h1>
      <p>{t['admin.advertising.connectionsDescription']()}</p>
    </div>

    {#if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
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
      {#if connectionsError}
        <Alert variant="error">
          {connectionsError}
          <Button variant="secondary" onclick={retry}>{t['common.retry']()}</Button>
        </Alert>
      {/if}

      {#if platforms.length === 0}
        <EmptyState
          title={t['admin.advertising.empty']()}
          description={t['admin.advertising.emptyDescription']()}
        />
      {:else}
        <div>
          <Stack gap="4">
            <h2>{t['admin.advertising.platformsHeading']()}</h2>
            {#each platforms as platform (platform.key)}
              {@const connection = connectionFor(platform)}
              <AdPlatformCard
                platform={platform}
                entitled={platformEntitled(platform)}
                connectionLabels={{
                  [platform.connection_state]: connectionLabelFor(platform),
                }}
                connectionTones={{ connected: 'success' }}
                connectDisabled={startingPlatform !== undefined}
                labels={{
                  connectCta:
                    connection && connection.status !== 'disconnected'
                      ? t['admin.advertising.connectDifferentCta']()
                      : t['admin.advertising.connectCta'](),
                  connectDisabledReason: t['admin.advertising.connectStartingReason'](),
                  upgradeTitle: t['admin.advertising.upgradeTitle'](),
                  upgradeDescription: t['admin.advertising.cardUpgradeDescription']({
                    platform: platform.display_name,
                  }),
                  upgradeCtaLabel: t['admin.advertising.upgradeCtaLabel'](),
                  capabilitiesLabel: t['admin.advertising.capabilitiesLabel'](),
                  objectivesLabel: t['admin.advertising.objectivesLabel'](),
                  placementsLabel: t['admin.advertising.placementsLabel'](),
                  unavailableTitle: t['admin.advertising.unavailableTitle'](),
                  unavailableDescription: t['admin.advertising.unavailableDescription'](),
                  scopesLabel: t['admin.advertising.scopesHeading'](),
                }}
                onConnect={() => void connectFlow(platform)}
              >
                {#snippet status()}
                  {#if connection}
                    <AdConnectionHealth
                      status={connection.status}
                      health={connection.health}
                      labels={healthLabelsFor(connection)}
                      onAction={
                        isReconnectState(connection)
                          ? () => void connectFlow(platform)
                          : undefined
                      }
                    />
                    {#if connection.health.scopes_missing.length > 0}
                      <Stack gap="2">
                        <p class="sanvi-ad-connections__scopes-heading">
                          {t['admin.advertising.missingScopesHeading']()}
                        </p>
                        <ul class="sanvi-ad-connections__scope-list">
                          {#each connection.health.scopes_missing as scope (scope)}
                            <li>{scopeDisplayName(scope)}</li>
                          {/each}
                        </ul>
                      </Stack>
                    {/if}
                  {:else if startingPlatform === platform.key}
                    <Spinner label={t['admin.advertising.connectStarting']()} />
                  {:else}
                    <p class="sanvi-ad-connections__preconnect">
                      {t['admin.advertising.preConnectExplainer']({
                        platform: platform.display_name,
                      })}
                    </p>
                  {/if}
                {/snippet}
              </AdPlatformCard>

              {#if connection}
                <div class="sanvi-ad-connections__connection-row">
                  <p class="sanvi-ad-connections__connection-meta">
                    {t['admin.advertising.connectionSummary']({
                      account: connection.account_name ?? connection.external_account_id,
                      currency: connection.currency,
                      timezone: connection.timezone,
                    })}
                  </p>
                  <Button variant="danger" onclick={() => openDisconnect(connection)}>
                    {t['admin.advertising.disconnectButton']()}
                  </Button>
                </div>
              {/if}
            {/each}
          </Stack>
        </div>
      {/if}
    {/if}
  </Stack>
</Container>

<Dialog bind:open={disconnectOpen} titleText={t['admin.advertising.disconnectTitle']()}>
  {#snippet children()}
    <Stack gap="4">
      {#if !freshAal2()}
        <!-- Step-up leg of the dialog: the mutation needs a fresh aal2, so
             the consequences stay put and the confirm is replaced by the
             re-authentication it requires. -->
        <Alert variant="warning">
          {t['admin.advertising.stepUpRequiredMessage']()}
        </Alert>
        <Button variant="primary" onclick={handleDisconnectRequested}>
          {t['admin.advertising.stepUpAction']()}
        </Button>
      {:else}
        <!-- Above the fold, first line, its own line: disconnecting in
             Sanvi does not pause the tenant's ads — they keep spending. -->
        <Alert variant="warning">
          <ul class="sanvi-ad-connections__consequences">
            <li>{t['admin.advertising.disconnectConsequenceSpending']()}</li>
            <li>{t['admin.advertising.disconnectConsequenceMetrics']()}</li>
            <li>{t['admin.advertising.disconnectConsequenceUploads']()}</li>
          </ul>
        </Alert>

        <p class="sanvi-ad-connections__disconnect-account">{disconnectConsequence}</p>

        {#if disconnectError}
          <Alert variant="error">{disconnectError}</Alert>
        {/if}

        <Field
          label={t['admin.advertising.disconnectConfirmPrompt']({ phrase: 'DISCONNECT' })}
          required
        >
          {#snippet children(controlProps)}
            <Input
              {...controlProps}
              bind:value={disconnectPhrase}
              placeholder={t['admin.advertising.disconnectInputPlaceholder']()}
              disabled={disconnecting}
            />
          {/snippet}
        </Field>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    {#if freshAal2()}
      <Button
        variant="ghost"
        onclick={() => {
          disconnectOpen = false
        }}
        disabled={disconnecting}
      >
        {t['common.cancel']()}
      </Button>
      <Button
        variant="danger"
        disabled={disconnectPhrase.trim() !== 'DISCONNECT' || disconnecting}
        loading={disconnecting}
        onclick={() => void handleDisconnectConfirm()}
      >
        {t['admin.advertising.disconnectConfirmButton']()}
      </Button>
    {:else}
      <Button
        variant="secondary"
        onclick={() => {
          disconnectOpen = false
        }}
      >
        {t['common.cancel']()}
      </Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-connections__preconnect {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-connections__scopes-heading {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-connections__scope-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-connections__connection-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    flex-wrap: wrap;
    margin-block-start: calc(-1 * var(--sanvi-spacing-4));
  }

  .sanvi-ad-connections__connection-meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-connections__consequences {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
  }

  .sanvi-ad-connections__disconnect-account {
    margin: 0;
    font-weight: var(--sanvi-font-weight-medium);
  }
</style>
