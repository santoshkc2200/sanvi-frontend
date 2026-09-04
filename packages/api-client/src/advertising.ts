import type { components } from './generated/types'
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
