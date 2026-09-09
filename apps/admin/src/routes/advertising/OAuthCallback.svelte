<script lang="ts">
import { redeemAdOAuthCallback } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { Alert, Button, Container, Spinner, Stack } from '@sanvi/ui'
import { setPendingAdConnection } from '../../lib/advertising-connect.svelte'
import { apiClient } from '../../lib/api'

/**
 * The OAuth return route (`/advertising/connect/:platform/callback`, phase
 * 10, TASK-011). The ad platform sent the browser back here with its
 * authorization response; this page redeems it server-side — `state` and
 * `code` go to the backend, which exchanges the code, vaults the tokens,
 * and answers with the pending connection and its reachable ad accounts —
 * then hands off to the account picker.
 *
 * The page never sees a token and never builds an authorization URL; its
 * only URL contribution is the `redirect_uri` of this very route, which
 * must be byte-identical to the one `start` was called with. A 400 here is
 * the backend saying the state was forged, expired, replayed, or
 * cross-tenant — rendered as a restartable error, never retried silently
 * (a retry would replay the consumed code).
 */
let { platform }: { platform: string } = $props()

let loading = $state(true)
let errorMessage = $state<string | undefined>(undefined)
let invalidRequest = $state(false)
let accessDenied = $state(false)
let platformError = $state(false)

function backToConnections(): void {
  navigate('/advertising/connections')
}

$effect(() => {
  // Runs once per mount: the query is read here rather than reactively —
  // the authorization response is a single, consumable event.
  const query = new URLSearchParams(window.location.search)
  const errorParam = query.get('error')

  if (errorParam === 'access_denied') {
    loading = false
    accessDenied = true
    return
  }

  if (errorParam) {
    loading = false
    platformError = true
    return
  }

  const state = query.get('state')
  const code = query.get('code')

  if (!state || !code) {
    loading = false
    invalidRequest = true
    return
  }

  const redirectUri = `${window.location.origin}/advertising/connect/${platform}/callback`

  void (async () => {
    try {
      const pending = await redeemAdOAuthCallback(apiClient, platform, {
        state,
        code,
        redirectUri,
      })
      setPendingAdConnection({
        platform,
        connectionId: pending.id,
        accounts: pending.accounts,
        redeemedAt: Date.now(),
      })
      navigate(`/advertising/connect/${platform}`)
    } catch {
      loading = false
      // 400 covers forged/expired/replayed/cross-tenant state and a failed
      // exchange; 403 (missing permission) and 404 (flag off) read the same
      // to the tenant: this attempt is over, restart from the connections
      // screen — never a silent retry, which would replay a consumed code.
      errorMessage = t['admin.advertising.oauthCallbackFailed']()
    }
  })()
})
</script>

<svelte:head>
  <title>{t['admin.advertising.connectionsTitle']()}</title>
</svelte:head>

<Container size="sm" padding="6">
  <Stack gap="6">
    <h1>{t['admin.advertising.connectingTitle']()}</h1>

    {#if loading}
      <Spinner label={t['admin.advertising.connectingProgress']()} />
      <p role="status">{t['admin.advertising.connectingProgress']()}</p>
    {:else if accessDenied}
      <Alert variant="warning">{t['admin.advertising.oauthCallbackAccessDenied']()}</Alert>
      <p>{t['admin.advertising.oauthCallbackRestartHint']()}</p>
      <Button variant="primary" onclick={backToConnections}>
        {t['admin.advertising.backToConnections']()}
      </Button>
    {:else if platformError}
      <Alert variant="error">{t['admin.advertising.oauthCallbackPlatformError']()}</Alert>
      <p>{t['admin.advertising.oauthCallbackRestartHint']()}</p>
      <Button variant="primary" onclick={backToConnections}>
        {t['admin.advertising.backToConnections']()}
      </Button>
    {:else if invalidRequest}
      <Alert variant="error">{t['admin.advertising.oauthCallbackMissingParams']()}</Alert>
      <Button variant="primary" onclick={backToConnections}>
        {t['admin.advertising.backToConnections']()}
      </Button>
    {:else if errorMessage}
      <Alert variant="error">{errorMessage}</Alert>
      <p>{t['admin.advertising.oauthCallbackRestartHint']()}</p>
      <Button variant="primary" onclick={backToConnections}>
        {t['admin.advertising.backToConnections']()}
      </Button>
    {/if}
  </Stack>
</Container>
