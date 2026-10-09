import type { components } from './generated/types'
import type { ResponseMeta } from './client'
import type { TypedApiClient } from './typed'

/**
 * The advertising (phase 10) contract endpoints. Slices extend this file —
 * one function per endpoint, documented with its gating — so campaign and
 * connection screens never call `fetch` themselves (repo non-negotiable #3).
 *
 * Gating summary: every `/api/v1/tenant/ads` route requires the
 * `advertising.read` permission and is served only while the
 * `advertising.enabled` flag is on (route absent → 404). The platform
 * catalog additionally requires at least one platform entitlement
 * (`advertising.google_ads`, `advertising.meta_ads`) — otherwise 403, which
 * the admin shell (TASK-009) renders as an `UpgradePrompt`.
 *
 * Connection routes (TASK-011) tighten this further: `oauth/start`,
 * `create_connection`, and `delete_connection` all require *fresh* aal2 —
 * ad account access is money access, so the backend answers 403 when the
 * session has not re-authenticated within the freshness window, and the
 * connection screen routes to step-up instead of surfacing that as an error.
 *
 * The OAuth handoff's security shape lives here in one place, where review
 * can see it: the frontend never holds a token, never holds a client
 * secret, and never constructs an authorization URL. It POSTs the backend
 * its own redirect URI, sends the browser to the `authorization_url` the
 * backend returned, and comes back to a route that redeems `state` + `code`
 * server-side. The only URL this side of the contract builds is the
 * redirect URI of the SPA's own callback route.
 */

export type PlatformsView = components['schemas']['PlatformsView']
export type PlatformView = components['schemas']['PlatformView']
export type StartOAuthResponse = components['schemas']['StartOAuthResponse']
export type PendingConnectionView = components['schemas']['PendingConnectionView']
export type AdAccountView = components['schemas']['AccountView']
export type ConnectionView = components['schemas']['ConnectionView']
export type ConnectionsView = components['schemas']['ConnectionsView']
export type ConnectionHealthView = components['schemas']['ConnectionHealthView']

/**
 * `GET /api/v1/tenant/ads/platforms` — the registry-derived advertising
 * platform catalog. Each entry carries its own entitlement state
 * (`upgrade_required` / `available`) so clients can render an upgrade path
 * per platform instead of a dead end. Returns an empty `platforms` array
 * until the backend registers capability matrices — which is exactly what
 * proves the generation pipeline end to end (TASK-009).
 */
export function listAdPlatforms(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/platforms', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/connections/{platform}/oauth/start` — begins the
 * OAuth handoff. The caller passes the SPA's own callback route as
 * `redirect_uri` (the backend refuses a missing one and the platform
 * rejects a mismatched one at exchange time); the response's
 * `authorization_url` is backend-built and opaque to this client — send the
 * browser there verbatim, never parse, store, or rebuild it. Requires
 * `advertising.connect`, the platform entitlement, and fresh aal2.
 */
export function startAdOAuth(
  client: TypedApiClient,
  platform: string,
  redirectUri: string,
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/ads/connections/{platform}/oauth/start',
    { redirect_uri: redirectUri },
    signal ? { params: { path: { platform } }, signal } : { params: { path: { platform } } },
  )
}

/**
 * `GET /api/v1/tenant/ads/connections/{platform}/oauth/callback` — redeems
 * the platform's authorization response server-side: the backend exchanges
 * `code` at the platform, stores the tokens in the vault, and returns the
 * pending connection with the ad accounts the credentials can see. The
 * `redirect_uri` must be byte-identical to the one sent to `start`. A
 * forged, expired, replayed, or cross-tenant `state` is a 400.
 */
export function redeemAdOAuthCallback(
  client: TypedApiClient,
  platform: string,
  params: { state: string; code: string; redirectUri: string },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/connections/{platform}/oauth/callback', {
    params: {
      path: { platform },
      query: { state: params.state, code: params.code, redirect_uri: params.redirectUri },
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/connections` — every connection with
 * **server-computed** health (`can_sync`, `can_upload_conversions`,
 * `token_expires_at`, `scopes_missing`, `reconnect_required`, `last_error`,
 * `last_synced_at`). Screens render these fields as they arrive and never
 * re-derive status from raw state — if a screen finds itself computing
 * `can_sync` itself, the fix is a backend field, not frontend logic.
 */
export function listAdConnections(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/connections', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/connections` — finalizes a pending connection by
 * choosing one of the accounts the callback returned. The ad account's
 * currency (ISO-4217 alpha-3) and IANA timezone are declared here, at
 * selection time — they silently define what "today" means in every metric
 * the platform reports, which is why the picker asks for them explicitly
 * instead of guessing. Requires `advertising.connect` and fresh aal2.
 */
export function createAdConnection(
  client: TypedApiClient,
  body: {
    connectionId: string
    externalAccountId: string
    currency: string
    timezone: string
  },
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/ads/connections',
    {
      connection_id: body.connectionId,
      external_account_id: body.externalAccountId,
      currency: body.currency,
      timezone: body.timezone,
    },
    signal ? { signal } : undefined,
  )
}

/**
 * `DELETE /api/v1/tenant/ads/connections/{connection_id}` — disconnects in
 * Sanvi only: metrics stop updating and conversion uploads stop, but the
 * campaigns keep running (and spending) on the platform. Requires
 * `advertising.connect` and fresh aal2; answers 204.
 */
export function deleteAdConnection(client: TypedApiClient, connectionId: string) {
  return client.DELETE('/api/v1/tenant/ads/connections/{connection_id}', {
    params: { path: { connection_id: connectionId } },
  })
}

// ---------------------------------------------------------------------------
// Campaigns (TASK-012 — slice 10.3)
//
// Gating: every campaign route answers 403 without `advertising.campaign.write`
// for writes (`advertising.read` suffices for reads) and 503
// `advertising/platform-unavailable` while the platform's flag is off —
// reads stay available, mutations refuse, and the UI must say the live
// campaigns keep spending rather than implying they are paused.
//
// Two headers carry the safety the campaign UI cannot opt out of:
//   - `Idempotency-Key` — a retried or timed-out mutation answers the
//     original result instead of creating/pausing/publishing twice.
//   - `If-Match` (PATCH and the ad-group/ad sub-resources) — the campaign's
//     current revision; a stale value is a 409 carrying the current state,
//     which the UI renders as "changed since you opened this" and never a
//     silent retry.
// ---------------------------------------------------------------------------

export type CampaignView = components['schemas']['CampaignView']
export type CampaignsView = components['schemas']['CampaignsView']
export type Campaign = components['schemas']['Campaign']
export type CampaignStatus = components['schemas']['CampaignStatus']
export type CampaignChange = components['schemas']['CampaignChange']
export type CampaignChangesView = components['schemas']['CampaignChangesView']
export type ChangeSource = components['schemas']['ChangeSource']
export type Budget = components['schemas']['Budget']
export type BudgetType = components['schemas']['BudgetType']
export type Money = components['schemas']['Money']
export type Schedule = components['schemas']['Schedule']
export type AdGroup = components['schemas']['AdGroup']
export type Ad = components['schemas']['Ad']
export type Creative = components['schemas']['Creative']
export type CreativeText = components['schemas']['CreativeText']
export type Targeting = components['schemas']['Targeting']
export type BidSettings = components['schemas']['BidSettings']
export type CreateCampaignRequest = components['schemas']['CreateCampaignRequest']
export type PatchCampaignRequest = components['schemas']['PatchCampaignRequest']
export type CreateAdGroupRequest = components['schemas']['CreateAdGroupRequest']
export type PatchAdGroupRequest = components['schemas']['PatchAdGroupRequest']
export type CreateAdRequest = components['schemas']['CreateAdRequest']
export type PatchAdRequest = components['schemas']['PatchAdRequest']
export type ValidationResultView = components['schemas']['ValidationResultView']
export type ValidationViolation = components['schemas']['ValidationViolation']
export type DriftState = components['schemas']['DriftState']
export type DriftResolution = components['schemas']['DriftResolution']
export type ResolvedCampaignDriftView = components['schemas']['ResolvedCampaignDriftView']

/**
 * `GET /api/v1/tenant/ads/campaigns` — every campaign owned by the tenant,
 * newest first, across every connected platform (the list is built for two
 * platforms from day one; the `platform` field on each view is what the
 * table's badge and per-currency rendering key off).
 */
export function listAdCampaigns(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/campaigns', signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/ads/campaigns/{campaign_id}` — one campaign's current
 * intent, revision, and platform drift state.
 */
export function getAdCampaign(client: TypedApiClient, campaignId: string, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/campaigns/{campaign_id}', {
    params: { path: { campaign_id: campaignId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns` — creates the campaign as a *draft*
 * on Sanvi's side; it never touches the platform until `publishAdCampaign`.
 * Requires an `Idempotency-Key`; a double-submitted builder produces one
 * campaign, never two.
 */
export function createAdCampaign(
  client: TypedApiClient,
  body: CreateCampaignRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/ads/campaigns', body, {
    idempotencyKey,
    ...(signal ? { signal } : {}),
  })
}

/**
 * `PATCH /api/v1/tenant/ads/campaigns/{campaign_id}` — a merge patch of the
 * campaign's intent. Carries `If-Match: <revision>`; the backend answers a
 * stale revision with 409 and the current state — a conflict the UI renders,
 * never retries.
 */
export function patchAdCampaign(
  client: TypedApiClient,
  campaignId: string,
  body: PatchCampaignRequest,
  options: { idempotencyKey: string; revision: number },
) {
  return client.PATCH('/api/v1/tenant/ads/campaigns/{campaign_id}', body, {
    params: { path: { campaign_id: campaignId } },
    headers: { 'If-Match': String(options.revision) },
    idempotencyKey: options.idempotencyKey,
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/validate` — the backend's
 * validator as a dry run: field-addressed violations, never writes. Omitted
 * fields keep the stored value, so an edit form validates its delta against
 * the campaign as stored.
 */
export function validateAdCampaign(
  client: TypedApiClient,
  campaignId: string,
  body: PatchCampaignRequest,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/validate', body, {
    params: { path: { campaign_id: campaignId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/publish` — pushes the
 * draft to the platform and records the platform-assigned id. Requires an
 * `Idempotency-Key` (a retry after a timeout returns the one campaign that
 * was created, never a second). A platform-side validation failure is a 400
 * whose field violations the builder maps onto the form.
 */
export function publishAdCampaign(
  client: TypedApiClient,
  campaignId: string,
  idempotencyKey: string,
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/publish', undefined, {
    params: { path: { campaign_id: campaignId } },
    idempotencyKey,
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/pause` — pauses on the
 * platform, not just in Sanvi. Requires an `Idempotency-Key`. 409 when the
 * campaign was never published — a draft has nothing on the platform to pause.
 */
export function pauseAdCampaign(
  client: TypedApiClient,
  campaignId: string,
  idempotencyKey: string,
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/pause', undefined, {
    params: { path: { campaign_id: campaignId } },
    idempotencyKey,
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/resume` — the inverse of
 * pause, same contract. Resuming puts money back into motion, which is why
 * the UI confirms it with the same weight as pausing.
 */
export function resumeAdCampaign(
  client: TypedApiClient,
  campaignId: string,
  idempotencyKey: string,
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/resume', undefined, {
    params: { path: { campaign_id: campaignId } },
    idempotencyKey,
  })
}

/**
 * `GET /api/v1/tenant/ads/campaigns/{campaign_id}/changes` — the newest-first
 * attributed change log: actor, source (`sanvi` | `platform`), and the full
 * before/after states. This is what the detail view answers "who paused this"
 * from, and what the drift diff builds from (the newest platform-sourced
 * entry's `before_state` is our intent; its `after_state` is the platform's).
 */
export function listAdCampaignChanges(
  client: TypedApiClient,
  campaignId: string,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/campaigns/{campaign_id}/changes', {
    params: { path: { campaign_id: campaignId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/drift` — resolves an
 * observed drift explicitly. The body names the resolution (`keep_theirs` |
 * `reapply_ours`) and the revision the decision was made against; there is no
 * default and no auto-resolve anywhere in the client. Requires an
 * `Idempotency-Key` — a replayed resolution answers its original result.
 */
export function resolveAdCampaignDrift(
  client: TypedApiClient,
  campaignId: string,
  body: { resolution: DriftResolution; revision: number },
  idempotencyKey: string,
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/drift', body, {
    params: { path: { campaign_id: campaignId } },
    idempotencyKey,
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups` — appends an
 * ad group. Carries `If-Match` (like PATCH) because it mutates the campaign's
 * revision; if the campaign is published, the append is pushed to the
 * platform in the same transaction.
 */
export function addAdAdGroup(
  client: TypedApiClient,
  campaignId: string,
  body: CreateAdGroupRequest,
  options: { idempotencyKey: string; revision: number },
) {
  return client.POST('/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups', body, {
    params: { path: { campaign_id: campaignId } },
    headers: { 'If-Match': String(options.revision) },
    idempotencyKey: options.idempotencyKey,
  })
}

/**
 * `PATCH /api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}` —
 * a merge patch of one ad group (name, bid, targeting).
 */
export function patchAdAdGroup(
  client: TypedApiClient,
  campaignId: string,
  adGroupId: string,
  body: PatchAdGroupRequest,
  options: { idempotencyKey: string; revision: number },
) {
  return client.PATCH('/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}', body, {
    params: { path: { campaign_id: campaignId, ad_group_id: adGroupId } },
    headers: { 'If-Match': String(options.revision) },
    idempotencyKey: options.idempotencyKey,
  })
}

/**
 * `POST /api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads`
 * — appends an ad referencing a stored creative id.
 */
export function addAdAd(
  client: TypedApiClient,
  campaignId: string,
  adGroupId: string,
  body: CreateAdRequest,
  options: { idempotencyKey: string; revision: number },
) {
  return client.POST(
    '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads',
    body,
    {
      params: { path: { campaign_id: campaignId, ad_group_id: adGroupId } },
      headers: { 'If-Match': String(options.revision) },
      idempotencyKey: options.idempotencyKey,
    },
  )
}

// ---------------------------------------------------------------------------
// Creatives & placement previews (TASK-013 — slice 10.4)
//
// Gating: reads answer 403 without `advertising.read` or the connection's
// platform entitlement; creates carry an `Idempotency-Key` (a retried mint
// answers the original creative). The create request is validated at
// upload time against the connection's platform capability matrix —
// placement, per-locale text limits, and per-asset spec (the client sends
// the measured `assets` metadata alongside the opaque `asset_references`).
// A violation is a 400 whose field violations name the dimension
// (`assets[0].width_px`, `placement`, `texts[0].headline`).
// ---------------------------------------------------------------------------

export type CreativeView = components['schemas']['CreativeView']
export type CreativesView = components['schemas']['CreativesView']
export type CreateCreativeRequest = components['schemas']['CreateCreativeRequest']
export type CreativeAssetSpec = components['schemas']['CreativeAssetSpec']
export type CreativePreviewView = components['schemas']['CreativePreviewView']
export type CreativePreviewsView = components['schemas']['CreativePreviewsView']
export type AssetMetadata = components['schemas']['AssetMetadata']

/**
 * `GET /api/v1/tenant/ads/creatives` — every creative on an entitled
 * platform, newest first. The `platform` field on each view is what the
 * list's badge keys off; `assets` carries the platform-confirmed metadata
 * when the backend has it.
 */
export function listAdCreatives(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/creatives', signal ? { signal } : undefined)
}

/**
 * `GET /api/v1/tenant/ads/creatives/{creative_id}` — one stored creative
 * with its placement, per-locale texts, and asset references.
 */
export function getAdCreative(client: TypedApiClient, creativeId: string, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/creatives/{creative_id}', {
    params: { path: { creative_id: creativeId } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/creatives` — creates a creative for one
 * placement of the connection's platform. Requires an `Idempotency-Key`.
 * Validation happens here, at upload time, against the platform's matrix:
 * an unsupported placement, copy over a locale's limit, or an asset missing
 * a spec dimension is a 400 with field violations — the form renders them
 * instead of a broken ad shipping later.
 */
export function createAdCreative(
  client: TypedApiClient,
  body: CreateCreativeRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/ads/creatives', body, {
    idempotencyKey,
    ...(signal ? { signal } : {}),
  })
}

/**
 * `DELETE /api/v1/tenant/ads/creatives/{creative_id}` — deletes the stored
 * creative. A creative already referenced by a live ad is refused by the
 * backend; answers 204 otherwise.
 */
export function deleteAdCreative(client: TypedApiClient, creativeId: string) {
  return client.DELETE('/api/v1/tenant/ads/creatives/{creative_id}', {
    params: { path: { creative_id: creativeId } },
  })
}

/**
 * `GET /api/v1/tenant/ads/creatives/{creative_id}/previews` — the
 * spec-rendered preview set: per placement, the spec, the copy, and the
 * asset references, exactly as the platform would compose them. The
 * optional `placement` narrows the set to one placement.
 */
export function getAdCreativePreviews(
  client: TypedApiClient,
  creativeId: string,
  placement?: string,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/creatives/{creative_id}/previews', {
    params: {
      path: { creative_id: creativeId },
      ...(placement ? { query: { placement } } : {}),
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `PATCH /api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads/{ad_id}`
 * — a merge patch of one ad (creative reference, landing URL, tracking
 * template).
 */
export function patchAdAd(
  client: TypedApiClient,
  campaignId: string,
  adGroupId: string,
  adId: string,
  body: PatchAdRequest,
  options: { idempotencyKey: string; revision: number },
) {
  return client.PATCH(
    '/api/v1/tenant/ads/campaigns/{campaign_id}/ad-groups/{ad_group_id}/ads/{ad_id}',
    body,
    {
      params: { path: { campaign_id: campaignId, ad_group_id: adGroupId, ad_id: adId } },
      headers: { 'If-Match': String(options.revision) },
      idempotencyKey: options.idempotencyKey,
    },
  )
}

// ---------------------------------------------------------------------------
// Conversion tracking (TASK-014 — slice 10.5)
//
// Gating: the settings routes require `advertising.connect`; the test event
// and the conversion list require `advertising.metrics.read`.
//
// Two words that must never be conflated on any screen that renders these
// endpoints: an event is *captured* when the storefront beacon reaches
// `/public/track`; it is *uploaded* when the backend later pushes it to an
// ad platform — which happens only when the capture-time directives permit
// it. This slice ships capture and its gate; upload status arrives with
// TASK-015, and until then upload columns render their "available after
// upload is enabled" label rather than looking broken or silently blank.
// ---------------------------------------------------------------------------

export type TrackingSettings = components['schemas']['TrackingSettings']
export type TrackConversionRequest = components['schemas']['TrackConversionRequest']
export type TestTrackingEventResponse = components['schemas']['TestTrackingEventResponse']
export type ConversionEvent = components['schemas']['ConversionEvent']
export type ClickIds = components['schemas']['ClickIds']
export type ConsentSnapshot = components['schemas']['ConsentSnapshot']
export type UploadState = components['schemas']['UploadState']
export type ValueSource = components['schemas']['ValueSource']

/**
 * `GET /api/v1/tenant/ads/tracking/settings` — the event-name →
 * (platform → conversion action) mappings. The matrix is the only source:
 * screens render and edit exactly these mappings and never carry a
 * hand-maintained event or platform list.
 */
export function getAdTrackingSettings(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/tracking/settings', signal ? { signal } : undefined)
}

/**
 * `PUT /api/v1/tenant/ads/tracking/settings` — replaces the whole mapping
 * matrix. Requires `advertising.connect`. The setup screen round-trips the
 * exact object it rendered; a mapping dropped in the UI is dropped in the
 * tenant's tracking, so the save confirms the matrix shape before sending.
 */
export function putAdTrackingSettings(
  client: TypedApiClient,
  body: TrackingSettings,
  signal?: AbortSignal,
) {
  return client.PUT('/api/v1/tenant/ads/tracking/settings', body, signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/tracking/test-event` — runs a synthetic event
 * through the exact same capture pipeline as `/public/track`, including the
 * directive gate, and returns what was captured and why — without
 * persisting anything. The response is flagged `test: true` so nothing can
 * mistake it for a real event.
 */
export function testAdTrackingEvent(
  client: TypedApiClient,
  body: TrackConversionRequest,
  signal?: AbortSignal,
) {
  return client.POST(
    '/api/v1/tenant/ads/tracking/test-event',
    body,
    signal ? { signal } : undefined,
  )
}

/**
 * `GET /api/v1/tenant/ads/conversions` — captured conversion events,
 * newest first, each carrying its frozen consent snapshot and per-platform
 * upload states. Requires `advertising.metrics.read`.
 */
export function listAdConversions(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/conversions', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/public/track` — the storefront beacon's endpoint. Unlike
 * every other function in this package it does **not** go through the
 * shared client: the beacon posts to the tenant's own verified domain
 * (same-origin), not the API origin, and it authenticates with an
 * `X-Site-Key` header the backend verifies against tenant + origin — a
 * header `navigator.sendBeacon` cannot carry.
 *
 * Transport priority follows from that constraint: when a site key is
 * configured, `fetch` with `keepalive` is the only header-bearing beacon-
 * grade transport, so it goes first; `sendBeacon` — which survives page
 * teardown equally well but cannot set headers — is the fallback for the
 * (currently hypothetical) header-less deployment. The backend answers
 * `202` with an uninformative body regardless of outcome, so the boolean
 * return is best-effort and callers must treat `false` as "unknown", never
 * as "not captured" — the storage layer's own idempotent insert is what
 * makes a retried or duplicated beacon safe.
 */
export async function sendConversionBeacon(input: {
  url: string
  body: TrackConversionRequest
  siteKey?: string | undefined
}): Promise<boolean> {
  const payload = JSON.stringify(input.body)
  const canBeacon = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
  if (!input.siteKey && canBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    return navigator.sendBeacon(input.url, blob)
  }
  if (typeof fetch !== 'function') return false
  try {
    const response = await fetch(input.url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(input.siteKey ? { 'X-Site-Key': input.siteKey } : {}),
      },
      body: payload,
    })
    return response.ok
  } catch {
    // The endpoint never reveals outcome and the beacon is fire-and-forget;
    // a network failure here is silently dropped, exactly like a 202.
    return false
  }
}

// ---------------------------------------------------------------------------
// Diagnostics & audiences (TASK-015 — slice 10.6)
//
// Gating: reads (diagnostics, conversions, audiences list) require
// `advertising.metrics.read`; the retry and audience writes require
// `advertising.campaign.write`. The retry endpoint is the one place this
// contract deliberately refuses compliance-sensitive work server-side: it
// answers 400/409 for a directive-suppressed or contact-identified event —
// the UI's own retry-button rule is only a courtesy; the backend's refusal
// is the enforcement.
//
// Suppression never appears in `upload_states`: a directive suppresses the
// whole event, and the frozen `ConsentSnapshot` carries which purpose was
// denied and by which signal source. A screen that finds itself looking for
// a suppression inside a platform state is misreading the contract.
// ---------------------------------------------------------------------------

export type ConversionDiagnostics = components['schemas']['ConversionDiagnostics']
export type Audience = components['schemas']['Audience']
export type AudienceStatus = components['schemas']['AudienceStatus']
export type CreateAudienceRequest = components['schemas']['CreateAudienceRequest']

/**
 * `GET /api/v1/tenant/ads/conversions/{id}/diagnostics` — the full
 * per-event story: the event (click ids, value source, frozen directive
 * snapshot, per-platform upload states) plus its capture timestamp. The
 * identifiers on the event are already hashed server-side; a screen must
 * never render anything that pretends to be raw customer data.
 */
export function getAdConversionDiagnostics(
  client: TypedApiClient,
  id: string,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/conversions/{id}/diagnostics', {
    params: { path: { id } },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/conversions/{id}/retry` — re-queues a *parked*
 * event for upload (parked platform states flip back to pending). The
 * backend refuses anything else: a directive-suppressed event (400/409 —
 * retrying it would override the subject's privacy directive), an event
 * whose consent was withdrawn since capture, and an email-identified
 * subject whose directive cannot be safely re-checked. Requires
 * `advertising.campaign.write`. Returns the updated event.
 */
export function retryAdConversion(client: TypedApiClient, id: string) {
  return client.POST('/api/v1/tenant/ads/conversions/{id}/retry', undefined, {
    params: { path: { id } },
  })
}

/**
 * `GET /api/v1/tenant/ads/audiences` — every audience owned by the tenant.
 * `included_identifiers` are server-side hashes; a UI renders them as the
 * hashes they are and offers no export of this screen.
 */
export function listAdAudiences(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/audiences', signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/audiences` — creates a draft audience for one
 * platform. The backend builds it from subjects whose `sale_or_share` and
 * `targeted_advertising` directives are both allowed; subjects opted out
 * are excluded at build time and removed from existing lists on refresh.
 */
export function createAdAudience(
  client: TypedApiClient,
  body: CreateAudienceRequest,
  signal?: AbortSignal,
) {
  return client.POST('/api/v1/tenant/ads/audiences', body, signal ? { signal } : undefined)
}

/**
 * `POST /api/v1/tenant/ads/audiences/{id}/refresh` — re-evaluates every
 * subject against the live directives and syncs the diff to the platform.
 * This is where opted-out subjects are *removed* from an existing list —
 * the removal is one-way, which is why the UI states the rule before the
 * first refresh button renders.
 */
export function refreshAdAudience(client: TypedApiClient, id: string) {
  return client.POST('/api/v1/tenant/ads/audiences/{id}/refresh', undefined, {
    params: { path: { id } },
  })
}

// ---------------------------------------------------------------------------
// Performance metrics (TASK-016 — slice 10.7)
//
// Gating: every metrics route requires `advertising.metrics.read`; the
// whole section answers 503 while the `advertising.dashboard` flag is off
// (rollback: the screens hide, the campaign list drops its spend columns —
// it never renders zeros, which would read as "you spent nothing").
//
// The invariant the shapes enforce: **two numbers, never one.** Every row
// carries the platform-reported `conversion_value` *and* the Sanvi-observed
// `sanvi_revenue` as separate fields with separate `roas_platform` /
// `roas_sanvi` ratios. No endpoint returns a merged attribution figure, and
// a client that sums the two — or computes a ratio across them — is the bug
// the grep gate exists to catch.
//
// Money is never summed across currencies either: rows are grouped per
// currency by the backend (`MetricsSummaryRow` is one row *per currency*),
// and each `MetricPoint`'s amounts stay in the ad account's own currency.
// ---------------------------------------------------------------------------
export type MetricPoint = components['schemas']['MetricPoint']
export type MetricsQueryResponse = components['schemas']['MetricsQueryResponse']
export type MetricsSummaryResponse = components['schemas']['MetricsSummaryResponse']
export type MetricsSummaryRow = components['schemas']['MetricsSummaryRow']
export type MetricsFreshnessView = components['schemas']['MetricsFreshnessView']
export type ConnectionFreshnessView = components['schemas']['ConnectionFreshnessView']
export type RenderedMoneyView = components['schemas']['RenderedMoneyView']

/** Query shared by the metrics routes — inclusive `YYYY-MM-DD` bounds. */
export interface AdMetricsQuery {
  from: string
  to: string
  /** `campaign` (default), `platform`, or `tenant`. */
  groupBy?: 'campaign' | 'platform' | 'tenant'
  platform?: string
  campaignId?: string
}

function adMetricsQueryParams(query: AdMetricsQuery) {
  return {
    from: query.from,
    to: query.to,
    ...(query.groupBy ? { group_by: query.groupBy } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.campaignId ? { campaign_id: query.campaignId } : {}),
  }
}

/**
 * `GET /api/v1/tenant/ads/metrics` — rollup rows for the requested range
 * and grain. Each row carries source currency, the ad account's platform,
 * and the `restating` marker: a day still inside the platform's
 * restatement window whose numbers may still change. A span past the
 * backend's configured maximum is a 400 — render its problem detail, never
 * a spinner.
 */
export function getAdMetrics(
  client: TypedApiClient,
  query: AdMetricsQuery,
  signal?: AbortSignal,
  onResponseMeta?: (meta: ResponseMeta) => void,
) {
  return client.GET('/api/v1/tenant/ads/metrics', {
    params: { query: adMetricsQueryParams(query) },
    ...(signal ? { signal } : {}),
    // TASK-023: a 2xx answered from a fallback names its degraded scopes in
    // `x-sanvi-degraded`; surfaces that render the numbers must be able to
    // *say* they are degraded.
    ...(onResponseMeta ? { onResponseMeta } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/metrics/summary?compare_to` — whole-range totals,
 * one row per currency, with an optional equal-length prior period to
 * compare against. `restating` is true when *any* day in the range is still
 * inside its restatement window.
 */
export function getAdMetricsSummary(
  client: TypedApiClient,
  query: { from: string; to: string; compareTo?: string },
  signal?: AbortSignal,
  onResponseMeta?: (meta: ResponseMeta) => void,
) {
  return client.GET('/api/v1/tenant/ads/metrics/summary', {
    params: {
      query: {
        from: query.from,
        to: query.to,
        ...(query.compareTo ? { compare_to: query.compareTo } : {}),
      },
    },
    ...(signal ? { signal } : {}),
    ...(onResponseMeta ? { onResponseMeta } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/metrics/export?format=csv` — the same labelled
 * columns as `/ads/metrics`, streamed as CSV with **no blended ROAS
 * column**. The backend 403s without `advertising.metrics.read`, so the
 * download button is permission-gated client-side too. The generated types
 * cannot express a `text/csv` success body (they resolve it to `undefined`)
 * while the runtime client returns the CSV text for that content type — the
 * cast below is the one place that gap is bridged, as in
 * `exportTenantPayments`.
 */
export function getAdMetricsExport(
  client: TypedApiClient,
  query: AdMetricsQuery,
  signal?: AbortSignal,
): Promise<string> {
  return client.GET('/api/v1/tenant/ads/metrics/export', {
    params: { query: adMetricsQueryParams(query) },
    ...(signal ? { signal } : {}),
  }) as unknown as Promise<string>
}

/**
 * The same export as {@link getAdMetricsExport}, but **streamed**: the
 * response body is handed over as a `ReadableStream` so the caller can pipe
 * it to disk (File System Access API) or assemble it chunk by chunk, instead
 * of holding an arbitrarily long date range's CSV in memory as one string.
 * Errors behave exactly like the buffered variant — `ApiError` including the
 * permission 403 — because everything before the 2xx body is shared client
 * machinery. Prefer this from UI download paths; the buffered call remains
 * for callers that genuinely want the text.
 */
export function streamAdMetricsExport(
  client: TypedApiClient,
  query: AdMetricsQuery,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  return client.stream('/api/v1/tenant/ads/metrics/export', {
    params: { query: adMetricsQueryParams(query) },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/metrics/freshness` — per-connection
 * `last_ingested_at`, `lag_hours`, and the backend-computed `stalled`
 * marker. The dashboard's "still updating" and "sync failed" states render
 * from this, never from a clock-based guess: if a screen finds itself
 * comparing timestamps to decide staleness, the fix is this endpoint, not
 * client-side arithmetic.
 */
export function getAdMetricsFreshness(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/metrics/freshness', signal ? { signal } : undefined)
}

// ---------------------------------------------------------------------------
// Budget caps, alerts & spend status (TASK-017 — slice 10.8)
//
// Gating: reads require `advertising.read`; cap writes require
// `advertising.budget.manage` (owner/manager roles — a member role's write
// is a 403). This is money-adjacent surface, so the screens confirm before
// the figures change, and every figure is rendered with the
// `data_freshness` the backend attaches to it.
//
// The division of labour the shapes enforce: the backend computes the
// figures (spend to date, run-rate projection, percentage, the exact action
// configured at each threshold) and the frontend renders them — a client
// that re-derives a percentage or a threshold action is the bug this
// contract shape exists to prevent. The one derivation left to the UI is a
// *preview* for a cap that does not exist yet (see the screens' live
// preview), which is always labelled projected.
//
// Contract health: `get_budget_alerts`, `get_campaign_budget_cap`, and
// `get_spend_status` declare their filters (`campaign_id`,
// `unacknowledged_only`, `limit`, `period`) as **query** parameters, matching
// the backend's `web::Query` structs — the `#[into_params(parameter_in =
// Query)]` annotations keep utoipa's `In: path` default from leaking into the
// generated types. If those call sites ever need a cast again, the annotations
// regressed: fix the backend, regenerate, and drop the cast.
// ---------------------------------------------------------------------------
export type BudgetCap = components['schemas']['BudgetCap']
export type BudgetCapsView = components['schemas']['BudgetCapsView']
export type BudgetPeriod = components['schemas']['BudgetPeriod']
export type BudgetAlert = components['schemas']['BudgetAlert']
export type BudgetAlertsView = components['schemas']['BudgetAlertsView']
export type AlertCondition = components['schemas']['AlertCondition']
export type DataFreshness = components['schemas']['DataFreshness']
export type BudgetActionsConfigured = components['schemas']['BudgetActionsConfigured']
export type SpendStatusItem = components['schemas']['SpendStatusItem']
export type SpendStatusReport = components['schemas']['SpendStatusReport']
export type PutBudgetCapRequest = components['schemas']['PutBudgetCapRequest']
export type PutBudgetCapResponse = components['schemas']['PutBudgetCapResponse']
export type DryRunEvaluationResult = components['schemas']['DryRunEvaluationResult']

/**
 * `GET /api/v1/tenant/ads/budget-caps` — every cap defined for the tenant,
 * tenant-wide and per campaign, daily and monthly.
 */
export function getAdBudgetCaps(client: TypedApiClient, signal?: AbortSignal) {
  return client.GET('/api/v1/tenant/ads/budget-caps', signal ? { signal } : undefined)
}

/**
 * `PUT /api/v1/tenant/ads/budget-caps` — creates or updates the
 * tenant-wide cap for one period. The request carries the cap's currency;
 * when the tenant's campaigns spend in several currencies the cap names an
 * explicit `declared_fx_basis` (+ optional `fx_rate_date`) — the UI never
 * picks a conversion basis silently. `dry_run: true` answers a
 * `DryRunEvaluationResult` (the live preview) instead of writing. Three
 * guarded paths, all confirmation-shaped:
 *   - `confirm_below_current_spend` — the backend answers 409
 *     (`advertising/cap-below-current-spend`-shaped conflict) when the new
 *     cap is below the period's spend so far; the retry carries the flag
 *     after the operator confirms a change that may pause campaigns at once.
 *   - `auto_pause: true` — enabling it is the typed-confirmation flow the
 *     caps screen owns; the backend records the cap version either way.
 *   - `expectedVersion` — the `If-Match` optimistic-locking guard: the
 *     version the editor read. **Required when the cap already exists** —
 *     the backend rejects a version-less write to an existing cap with 409
 *     (`cap_version_required`-shaped conflict), so a client following the
 *     OpenAPI's optional marking must still send it on updates. A stale
 *     version answers 409 too, and the loser reloads instead of silently
 *     overwriting. Omitting the header is valid only for creates (no cap
 *     exists for the scope+period yet) and for dry runs, which never touch
 *     a row.
 */
export function putAdBudgetCap(
  client: TypedApiClient,
  body: PutBudgetCapRequest,
  options?: { signal?: AbortSignal; expectedVersion?: number },
) {
  // No automatic retries: the shared client blind-retries PUT on timeout,
  // and this write is conditional — a first attempt that committed before
  // its response arrived would be retried with the stale If-Match (or, for
  // a create, against the row it just made) and answered 409, so the
  // operator would see a conflict despite a successful save. The caps
  // screen resubmits explicitly instead.
  return client.PUT('/api/v1/tenant/ads/budget-caps', body, {
    retries: 0,
    ...(options?.expectedVersion !== undefined
      ? { headers: { 'If-Match': String(options.expectedVersion) } }
      : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/campaigns/{campaign_id}/budget-cap?period` — one
 * campaign's cap for a period; 404 when none is set (a missing cap is a
 * state, not an error — the caps screen renders "no cap" rather than a
 * failure).
 */
export function getAdCampaignBudgetCap(
  client: TypedApiClient,
  campaignId: string,
  period?: BudgetPeriod,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/campaigns/{campaign_id}/budget-cap', {
    params: {
      path: { campaign_id: campaignId },
      ...(period ? { query: { period } } : {}),
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `PUT /api/v1/tenant/ads/campaigns/{campaign_id}/budget-cap` — the
 * campaign-scoped twin of {@link putAdBudgetCap}: same body semantics, same
 * dry-run and 409 confirmation paths, scoped to one campaign. Accepts the
 * same `expectedVersion` optimistic-locking guard — required when the
 * campaign's cap already exists, optional only for creates and dry runs
 * (see {@link putAdBudgetCap}).
 */
export function putAdCampaignBudgetCap(
  client: TypedApiClient,
  campaignId: string,
  body: PutBudgetCapRequest,
  options?: { signal?: AbortSignal; expectedVersion?: number },
) {
  // Same retry semantics as {@link putAdBudgetCap}: conditional write, no
  // automatic retries — a blind retry would replay a stale If-Match and
  // surface a 409 for an already-applied save.
  return client.PUT('/api/v1/tenant/ads/campaigns/{campaign_id}/budget-cap', body, {
    params: { path: { campaign_id: campaignId } },
    retries: 0,
    ...(options?.expectedVersion !== undefined
      ? { headers: { 'If-Match': String(options.expectedVersion) } }
      : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  })
}

/**
 * `GET /api/v1/tenant/ads/budget-alerts` — the alert history, newest
 * first. `unacknowledgedOnly` narrows to the entries still needing an
 * operator's eyes; `limit` caps the page.
 */
export function getAdBudgetAlerts(
  client: TypedApiClient,
  options?: { campaignId?: string; unacknowledgedOnly?: boolean; limit?: number },
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/budget-alerts', {
    params: {
      query: {
        ...(options?.campaignId ? { campaign_id: options.campaignId } : {}),
        ...(options?.unacknowledgedOnly !== undefined
          ? { unacknowledged_only: options.unacknowledgedOnly }
          : {}),
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      },
    },
    ...(signal ? { signal } : {}),
  })
}

/**
 * `POST /api/v1/tenant/ads/budget-alerts/{alert_id}/acknowledge` — marks one
 * alert acknowledged. Requires `advertising.budget.manage`; answers the
 * updated alert, which is what the history re-renders from (the
 * round-trip, not an optimistic local flip).
 */
export function acknowledgeAdBudgetAlert(client: TypedApiClient, alertId: string) {
  return client.POST('/api/v1/tenant/ads/budget-alerts/{alert_id}/acknowledge', undefined, {
    params: { path: { alert_id: alertId } },
  })
}

/**
 * `GET /api/v1/tenant/ads/spend-status?period` — per scope (tenant and each
 * campaign), the cap, spend to date, projected spend at the run rate,
 * percentage, `data_freshness`, the exact actions configured at each
 * threshold, and the currencies whose spend could not be converted to the
 * cap currency. Figures are render-only: the percentage and the threshold
 * actions arrive computed because a client-side recomputation is where
 * "the cap held" quietly becomes "the cap sort of held".
 */
export function getAdSpendStatus(
  client: TypedApiClient,
  period?: BudgetPeriod,
  signal?: AbortSignal,
) {
  return client.GET('/api/v1/tenant/ads/spend-status', {
    params: { ...(period ? { query: { period } } : {}) },
    ...(signal ? { signal } : {}),
  })
}
