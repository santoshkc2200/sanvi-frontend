import type { Page } from '@playwright/test'
import { AD_PLATFORM_FIXTURES, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * Hermetic advertising backend for the TASK-011 connection-flow specs —
 * catalog, OAuth handoff, and a stateful connections store so disconnect
 * actually removes what connect added.
 *
 * The OAuth round-trip is simulated in-app: `oauth/start` answers an
 * `authorization_url` pointing back at this app's own callback route with
 * `state`/`code` query params, exactly as a real platform would redirect
 * into it. No third-party origin is contacted.
 *
 * The session is `aal2` with a now-stamped `authenticated_at` so the
 * backend-mirrored freshness check (300s window) passes on mutating calls.
 */

export interface MockAdConnection {
  id: string
  platform: string
  external_account_id: string
  account_name: string | null
  currency: string
  timezone: string
  status: string
  health: Record<string, unknown>
}

export interface MockCampaignState {
  id: string
  name: string
  objective: string
  budget: { kind: string; amount: { amount_minor: number; currency: string } }
  schedule: { starts_at: string | null; ends_at: string | null } | null
  status: string
  drift: { drifted: boolean; changed_fields: string[] }
  ad_groups: unknown[]
}

export interface MockCampaignView {
  id: string
  connection_id: string
  platform: string
  external_id: string | null
  revision: number
  campaign: MockCampaignState
}

export interface MockCampaignChange {
  id: string
  campaign_id: string
  tenant_id: string
  revision: number
  actor_id: string | null
  source: 'sanvi' | 'platform'
  changed_fields: string[]
  before_state: MockCampaignState
  after_state: MockCampaignState
  created_at: string
  attribution: string | null
  mutation_id: string | null
  metadata: unknown
}

export interface AdvertisingMockControls {
  /** Simulates a native-tool edit on the platform side: the campaign drifts. */
  simulatePlatformEdit: (campaignId: string) => void
}

export function mockAdvertisingBackend(
  page: Page,
  options: {
    seedConnection?: boolean
    seedCreative?: boolean
    /** Two connections in different currencies (JPY + USD), for the
        cross-currency list assertions: rendered natively, never summed. */
    seedTwoConnections?: boolean
    /** One draft campaign per seeded connection, each in its account's currency. */
    seedTwoCampaigns?: boolean
  } = {},
): AdvertisingMockControls {
  const connections: MockAdConnection[] = []
  let pendingCounter = 0
  let connectionCounter = 0

  // The campaign specs address `conn_live_0` directly; the connection specs
  // seed connections through the real UI flow instead.
  if (options.seedConnection) {
    connectionCounter += 1
    connections.push({
      id: 'conn_live_0',
      platform: 'meta',
      external_account_id: '111-222',
      account_name: 'Acme Main Ad Account',
      currency: 'JPY',
      timezone: 'Asia/Tokyo',
      status: 'active',
      health: {
        can_sync: true,
        can_upload_conversions: true,
        scopes_missing: [],
        reconnect_required: false,
        token_expires_at: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      },
    })
  }

  // The second connection's platform comes from the fixture catalog — the
  // mock never spells a platform key itself.
  function otherPlatformFixture() {
    return AD_PLATFORM_FIXTURES.find((candidate) => candidate.key !== 'meta')!
  }

  function seedConnectionRecord(id: string, fixture: { key: string }, currency: string): void {
    connections.push({
      id,
      platform: fixture.key,
      external_account_id: '999-888',
      account_name: `Acme ${currency} Account`,
      currency,
      timezone: 'Asia/Tokyo',
      status: 'active',
      health: {
        can_sync: true,
        can_upload_conversions: true,
        scopes_missing: [],
        reconnect_required: false,
        token_expires_at: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      },
    })
  }

  if (options.seedTwoConnections) {
    connectionCounter += 1
    seedConnectionRecord('conn_live_0', { key: 'meta' }, 'JPY')
    connectionCounter += 1
    seedConnectionRecord('conn_live_1', otherPlatformFixture(), 'USD')
  }

  // Stateful campaign store (TASK-012): the fake adapter's semantics —
  // drafts never touch the platform until publish, mutations carry
  // idempotency keys, PATCH is revision-guarded, drift never auto-resolves.
  const campaigns: MockCampaignView[] = []
  const campaignChanges: MockCampaignChange[] = []
  const idempotencyReplay = new Map<string, unknown>()
  let campaignCounter = 0
  let changeCounter = 0

  function requireIdempotency(
    key: string | null,
    handler: () => unknown,
  ): {
    body: unknown
    replayed: boolean
  } {
    if (!key)
      return { body: { type: 'about:blank', title: 'Bad request', status: 400 }, replayed: false }
    if (idempotencyReplay.has(key)) return { body: idempotencyReplay.get(key), replayed: true }
    const body = handler()
    idempotencyReplay.set(key, body)
    return { body, replayed: false }
  }

  function recordChange(
    campaign: MockCampaignView,
    source: 'sanvi' | 'platform',
    changedFields: string[],
    mutate?: (state: MockCampaignState) => void,
  ): void {
    const before = structuredClone(campaign.campaign)
    mutate?.(campaign.campaign)
    changeCounter += 1
    campaignChanges.unshift({
      id: `chg_${changeCounter}`,
      campaign_id: campaign.id,
      tenant_id: 'dev-acme',
      revision: campaign.revision,
      actor_id: source === 'sanvi' ? me.user_id : null,
      source,
      changed_fields: changedFields,
      before_state: before,
      after_state: structuredClone(campaign.campaign),
      created_at: new Date().toISOString(),
      attribution: null,
      mutation_id: null,
      metadata: null,
    })
  }

  const me = {
    user_id: '0190f0d0-0000-7000-8000-000000000001',
    email: 'admin@example.com',
    email_verified: true,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    memberships: [
      {
        tenant_id: 'dev-acme',
        tenant_slug: 'acme',
        tenant_name: 'Acme Corporation',
        role_ids: ['owner'],
        status: 'active',
        permissions: [
          'advertising.read',
          'advertising.connect',
          'advertising.campaign.write',
          'billing.subscription.read',
          'tenancy.settings.read',
        ],
      },
    ],
  }
  const sessions = [
    {
      session_id: 'e2e-ad-session',
      aal: 'aal2',
      methods: ['totp', 'password'],
      // Fresh as of page-load time — the 300s freshness window on the
      // mutating advertising endpoints stays open for the whole spec.
      authenticated_at: new Date().toISOString(),
    },
  ]
  const context = {
    tenant_id: 'dev-acme',
    slug: 'acme',
    display_name: 'Acme Corporation',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'internal_header',
  }

  // Registered first — Playwright consults the *last* matching route first,
  // so this fallback only answers what the specific routes below don't.
  void page.route('**/api/v1/**', (route) => route.fulfill({ json: {} }))

  void page.route('**/api/v1/me', (route) => route.fulfill({ json: me }))
  void page.route('**/api/v1/me/sessions', (route) => route.fulfill({ json: sessions }))
  void page.route('**/api/v1/tenant/context', (route) => route.fulfill({ json: context }))
  void page.route('**/api/v1/tenant/settings', (route) =>
    route.fulfill({ json: { settings: { timezone: 'UTC' } } }),
  )
  void page.route('**/api/v1/tenant/entitlements', (route) => route.fulfill({ json: [] }))

  // The catalog comes from the backend's own committed capability-matrix
  // fixtures — the mock spells no matrix values or platform keys itself
  // (the matrix-is-the-only-source gate enforces exactly that).
  void page.route('**/api/v1/tenant/ads/platforms', (route) =>
    route.fulfill({
      json: {
        platforms: AD_PLATFORM_FIXTURES.map((fixture) =>
          platformViewFixture(fixture, {
            connection_state: connections.length > 0 ? 'connected' : 'not_connected',
          }),
        ),
      },
    }),
  )

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/start', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const platform = url.pathname.split('/')[6] ?? 'meta'
    const body = request.postDataJSON() as { redirect_uri?: string }
    void platform
    // The backend builds the platform URL; here it points back at this
    // app's callback route carrying the platform's "authorization response".
    const redirectUri = body.redirect_uri ?? ''
    pendingCounter += 1
    const state = `e2e-state-${pendingCounter}`
    const authorizationUrl = `${redirectUri}?state=${state}&code=e2e-code`
    void route.fulfill({ json: { authorization_url: authorizationUrl, state } })
  })

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/callback**', (route) => {
    const platform = new URL(route.request().url()).pathname.split('/')[6] ?? 'meta'
    void platform
    void route.fulfill({
      json: {
        id: `conn_pending_${pendingCounter}`,
        platform: 'meta',
        status: 'pending',
        accounts: [
          { external_id: '111-222', display_name: 'Acme Main Ad Account' },
          { external_id: '333-444', display_name: 'Acme EU Ad Account' },
        ],
      },
    })
  })

  void page.route('**/api/v1/tenant/ads/connections', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { connections } })
      return
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        connection_id: string
        external_account_id: string
        currency: string
        timezone: string
      }
      const account = [
        { external_id: '111-222', display_name: 'Acme Main Ad Account' },
        { external_id: '333-444', display_name: 'Acme EU Ad Account' },
      ].find((candidate) => candidate.external_id === body.external_account_id)
      if (!account) {
        await route.fulfill({
          status: 400,
          json: { type: 'about:blank', title: 'Bad request', status: 400 },
        })
        return
      }
      const connection: MockAdConnection = {
        id: `conn_live_${connectionCounter}`,
        platform: 'meta',
        external_account_id: body.external_account_id,
        account_name: account.display_name,
        currency: body.currency.toUpperCase(),
        timezone: body.timezone,
        status: 'active',
        health: {
          can_sync: true,
          can_upload_conversions: true,
          scopes_missing: [],
          reconnect_required: false,
          token_expires_at: null,
          last_error: null,
          last_synced_at: new Date().toISOString(),
        },
      }
      connectionCounter += 1
      connections.push(connection)
      await route.fulfill({ json: connection })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/connections/conn_*', async (route) => {
    const request = route.request()
    if (request.method() !== 'DELETE') {
      await route.fulfill({ json: {} })
      return
    }
    const id = new URL(request.url()).pathname.split('/').pop() ?? ''
    const index = connections.findIndex((connection) => connection.id === id)
    if (index >= 0) connections.splice(index, 1)
    await route.fulfill({ status: 204 })
  })

  // --- Campaigns (TASK-012) ----------------------------------------------

  void page.route('**/api/v1/tenant/ads/campaigns/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const parts = url.pathname.split('/')
    const id = parts[6] ?? ''
    const action = parts[7] // undefined for the campaign itself; publish/pause/resume/validate otherwise
    const campaign = campaigns.find((candidate) => candidate.id === id)
    if (!campaign) {
      await route.fulfill({
        status: 404,
        json: { type: 'about:blank', title: 'Not found', status: 404 },
      })
      return
    }

    if (!action) {
      if (request.method() === 'GET') {
        await route.fulfill({ json: campaign })
        return
      }
      if (request.method() === 'PATCH') {
        if (request.headers()['if-match'] !== String(campaign.revision)) {
          await route.fulfill({
            status: 409,
            json: { type: 'about:blank', title: 'Conflict', status: 409 },
          })
          return
        }
        const body = request.postDataJSON() as Partial<MockCampaignState>
        const changed: string[] = []
        if (body.name !== undefined && body.name !== campaign.campaign.name) changed.push('name')
        if (body.objective !== undefined && body.objective !== campaign.campaign.objective)
          changed.push('objective')
        if (
          body.budget !== undefined &&
          JSON.stringify(body.budget) !== JSON.stringify(campaign.campaign.budget)
        )
          changed.push('budget')
        if (
          body.schedule !== undefined &&
          JSON.stringify(body.schedule) !== JSON.stringify(campaign.campaign.schedule)
        )
          changed.push('schedule')
        const key = request.headers()['idempotency-key']
        const { body: result } = requireIdempotency(key, () => {
          if (body.name !== undefined) campaign.campaign.name = body.name
          if (body.objective !== undefined) campaign.campaign.objective = body.objective
          if (body.budget !== undefined) campaign.campaign.budget = body.budget
          if (body.schedule !== undefined) campaign.campaign.schedule = body.schedule
          campaign.revision += 1
          if (changed.length > 0) recordChange(campaign, 'sanvi', changed)
          return campaign
        })
        await route.fulfill({ json: result })
        return
      }
      await route.fulfill({ json: {} })
      return
    }

    if (action === 'validate') {
      await route.fulfill({ json: { violations: [] } })
      return
    }
    if (action === 'publish' || action === 'pause' || action === 'resume') {
      const key = request.headers()['idempotency-key']
      if (!key) {
        await route.fulfill({
          status: 400,
          json: { type: 'about:blank', title: 'Bad request', status: 400 },
        })
        return
      }
      if (action !== 'publish' && campaign.external_id === null) {
        await route.fulfill({
          status: 409,
          json: { type: 'about:blank', title: 'Conflict', status: 409 },
        })
        return
      }
      const { body: result } = requireIdempotency(key, () => {
        if (action === 'publish') {
          recordChange(campaign, 'sanvi', ['status', 'external_id'], (state) => {
            state.status = 'active'
          })
          campaign.external_id = `platform-${campaign.id}`
        } else {
          recordChange(campaign, 'sanvi', ['status'], (state) => {
            state.status = action === 'pause' ? 'paused' : 'active'
          })
        }
        campaign.revision += 1
        return campaign
      })
      await route.fulfill({ json: result })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/campaigns/*/changes', async (route) => {
    await route.fulfill({ json: { changes: campaignChanges } })
  })

  void page.route('**/api/v1/tenant/ads/campaigns/*/drift', async (route) => {
    const request = route.request()
    const id = new URL(request.url()).pathname.split('/')[6] ?? ''
    const campaign = campaigns.find((candidate) => candidate.id === id)
    if (!campaign) {
      await route.fulfill({
        status: 404,
        json: { type: 'about:blank', title: 'Not found', status: 404 },
      })
      return
    }
    const body = request.postDataJSON() as {
      resolution: 'keep_theirs' | 'reapply_ours'
      revision: number
    }
    if (!body.resolution || !request.headers()['idempotency-key']) {
      await route.fulfill({
        status: 400,
        json: { type: 'about:blank', title: 'Bad request', status: 400 },
      })
      return
    }
    if (body.revision !== campaign.revision) {
      await route.fulfill({
        status: 409,
        json: { type: 'about:blank', title: 'Conflict', status: 409 },
      })
      return
    }
    const latestPlatform = campaignChanges.find(
      (change) => change.campaign_id === id && change.source === 'platform',
    )
    const key = request.headers()['idempotency-key']
    const { body: result } = requireIdempotency(key, () => {
      if (body.resolution === 'keep_theirs' && latestPlatform) {
        campaign.campaign = structuredClone(latestPlatform.after_state)
      }
      campaign.revision += 1
      recordChange(
        campaign,
        'sanvi',
        latestPlatform?.changed_fields ?? campaign.campaign.drift.changed_fields,
      )
      campaign.campaign.drift = { drifted: false, changed_fields: [] }
      return {
        campaign,
        replayed: false,
        resolution: body.resolution,
        revision: campaign.revision,
      }
    })
    await route.fulfill({ json: result })
  })

  void page.route('**/api/v1/tenant/ads/campaigns', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { campaigns } })
      return
    }
    if (request.method() === 'POST') {
      const key = request.headers()['idempotency-key'] ?? null
      const body = request.postDataJSON() as {
        connection_id: string
        name: string
        objective: string
        budget: MockCampaignState['budget']
        schedule: MockCampaignState['schedule']
      }
      const { body: result } = requireIdempotency(key, () => {
        const connection = connections.find((candidate) => candidate.id === body.connection_id)
        if (!connection) return { type: 'about:blank', title: 'Not found', status: 404 }
        campaignCounter += 1
        const view: MockCampaignView = {
          id: `camp_${campaignCounter}`,
          connection_id: body.connection_id,
          platform: connection.platform,
          external_id: null,
          revision: 1,
          campaign: {
            id: `camp_${campaignCounter}`,
            name: body.name,
            objective: body.objective,
            budget: body.budget,
            schedule: body.schedule ?? null,
            status: 'draft',
            drift: { drifted: false, changed_fields: [] },
            ad_groups: [],
          },
        }
        campaigns.push(view)
        recordChange(view, 'sanvi', ['name', 'objective', 'budget', 'schedule'])
        return view
      })
      await route.fulfill({ json: result })
      return
    }
    await route.fulfill({ json: {} })
  })

  // --- Creatives & placement previews (TASK-013) --------------------------
  //
  // A stateful creative store with upload-time matrix validation mirrored
  // from the backend: placement must exist in the connection's platform
  // matrix, per-locale copy must fit its limit, and the client-measured
  // asset metadata must pass the placement's asset spec. Every placement
  // key, text limit, and spec value comes from the committed fixtures —
  // the mock spells none of them itself.
  interface MockCreative {
    id: string
    connection_id: string
    platform: string
    external_id: string | null
    creative: {
      id: string
      placement: string
      texts: { locale: string; headline: string; body: string }[]
      asset_references: string[]
    }
    assets: unknown[]
    created_at: string
    updated_at: string
  }

  const creatives: MockCreative[] = []
  const creativesLocked = new Set<string>()
  let creativeCounter = 0

  function creativeViolations(
    platformKey: string,
    body: {
      placement?: string
      texts?: { locale: string; headline: string; body: string }[]
      assets?: { width_px?: number; height_px?: number; file_size_bytes?: number }[]
    },
  ): { field_path: string; code: string; message: string }[] {
    const fixture = AD_PLATFORM_FIXTURES.find((candidate) => candidate.key === platformKey)
    const matrix = fixture?.capability_matrix
    const violations: { field_path: string; code: string; message: string }[] = []
    if (!matrix) return violations
    const placement = matrix.creative_placements.find(
      (candidate) => candidate.key === body.placement,
    )
    if (!placement) {
      violations.push({
        field_path: 'placement',
        code: 'unsupported',
        message: 'creative placement is unavailable for this platform',
      })
      return violations
    }
    for (const [index, text] of (body.texts ?? []).entries()) {
      const limits = matrix.text_limits[text.locale]
      if (!limits) continue
      for (const [field, value] of Object.entries({
        headline: text.headline,
        body: text.body,
      })) {
        const limit = limits[field]
        if (limit !== undefined && [...String(value ?? '')].length > limit) {
          violations.push({
            field_path: `texts[${index}].${field}`,
            code: 'invalid',
            message: `${field} exceeds the ${limit}-character ${text.locale} limit`,
          })
        }
      }
    }
    for (const [index, asset] of (body.assets ?? []).entries()) {
      const spec = placement.asset_spec
      const width = asset.width_px ?? 0
      const height = asset.height_px ?? 0
      if (
        spec.min_width_px !== null &&
        spec.min_width_px !== undefined &&
        width < spec.min_width_px
      ) {
        violations.push({
          field_path: `assets[${index}].width_px`,
          code: 'invalid',
          message: `asset width (${width}px) is below the minimum required width of ${spec.min_width_px}px`,
        })
      }
      if (
        spec.min_height_px !== null &&
        spec.min_height_px !== undefined &&
        height < spec.min_height_px
      ) {
        violations.push({
          field_path: `assets[${index}].height_px`,
          code: 'invalid',
          message: `asset height (${height}px) is below the minimum required height of ${spec.min_height_px}px`,
        })
      }
      if (
        spec.max_file_size_bytes !== null &&
        spec.max_file_size_bytes !== undefined &&
        (asset.file_size_bytes ?? 0) > spec.max_file_size_bytes
      ) {
        violations.push({
          field_path: `assets[${index}].file_size_bytes`,
          code: 'invalid',
          message: `asset file size (${asset.file_size_bytes} bytes) exceeds the maximum allowed ${spec.max_file_size_bytes} bytes`,
        })
      }
    }
    return violations
  }

  if (options.seedCreative) {
    const fixture = AD_PLATFORM_FIXTURES.find((candidate) => candidate.key === 'meta')!
    const matrix = fixture.capability_matrix
    creativeCounter += 1
    creatives.push({
      id: `cre_seed_${creativeCounter}`,
      connection_id: 'conn_live_0',
      platform: 'meta',
      external_id: null,
      creative: {
        id: `cre_seed_${creativeCounter}`,
        placement: matrix.creative_placements[0]!.key,
        texts: [
          { locale: 'en', headline: 'Summer sale', body: 'Up to 50% off everything' },
          { locale: 'ja', headline: '夏のセール', body: '全品最大50%オフ' },
        ],
        asset_references: ['asset_seed_1'],
      },
      assets: [],
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-02T00:00:00Z',
    })
  }

  void page.route('**/api/v1/tenant/ads/creatives/*/previews*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[6] ?? ''
    const creative = creatives.find((candidate) => candidate.id === id)
    if (!creative) {
      await route.fulfill({
        status: 404,
        json: { type: 'about:blank', title: 'Not found', status: 404 },
      })
      return
    }
    const fixture = AD_PLATFORM_FIXTURES.find((candidate) => candidate.key === creative.platform)
    const placement = fixture?.capability_matrix.creative_placements.find(
      (candidate) => candidate.key === creative.creative.placement,
    )
    const text = creative.creative.texts[0]
    await route.fulfill({
      json: {
        previews: [
          {
            placement: creative.creative.placement,
            headline: text?.headline ?? null,
            body: text?.body ?? null,
            asset_references: creative.creative.asset_references,
            spec: placement?.asset_spec ?? null,
          },
        ],
      },
    })
  })

  void page.route('**/api/v1/tenant/ads/creatives/*', async (route) => {
    const request = route.request()
    const id = new URL(request.url()).pathname.split('/')[6] ?? ''
    if (request.method() === 'DELETE') {
      if (creativesLocked.has(id)) {
        await route.fulfill({
          status: 409,
          json: { type: 'about:blank', title: 'Conflict', status: 409 },
        })
        return
      }
      const index = creatives.findIndex((candidate) => candidate.id === id)
      if (index >= 0) creatives.splice(index, 1)
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({ json: creatives.find((candidate) => candidate.id === id) ?? {} })
  })

  void page.route('**/api/v1/tenant/ads/creatives', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { creatives } })
      return
    }
    if (request.method() === 'POST') {
      if (!request.headers()['idempotency-key']) {
        await route.fulfill({
          status: 400,
          json: { type: 'about:blank', title: 'Bad request', status: 400 },
        })
        return
      }
      const body = request.postDataJSON() as {
        connection_id: string
        placement: string
        texts: { locale: string; headline: string; body: string }[]
        asset_references: string[]
        assets: {
          width_px: number
          height_px: number
          file_size_bytes: number
          aspect_ratio: string
          is_video: boolean
        }[]
      }
      const connection = connections.find((candidate) => candidate.id === body.connection_id)
      if (!connection) {
        await route.fulfill({
          status: 404,
          json: { type: 'about:blank', title: 'Not found', status: 404 },
        })
        return
      }
      const violations = creativeViolations(connection.platform, body)
      if (violations.length > 0) {
        await route.fulfill({
          status: 400,
          json: {
            type: 'about:blank',
            title: 'Bad request',
            status: 400,
            violations,
          },
        })
        return
      }
      creativeCounter += 1
      const now = new Date().toISOString()
      const creative: MockCreative = {
        id: `cre_${creativeCounter}`,
        connection_id: connection.id,
        platform: connection.platform,
        external_id: null,
        creative: {
          id: `cre_${creativeCounter}`,
          placement: body.placement,
          texts: body.texts,
          asset_references: body.asset_references,
        },
        assets: body.assets ?? [],
        created_at: now,
        updated_at: now,
      }
      creatives.unshift(creative)
      await route.fulfill({ json: creative })
      return
    }
    await route.fulfill({ json: {} })
  })

  if (options.seedTwoCampaigns) {
    for (const seeded of connections) {
      const fixture = AD_PLATFORM_FIXTURES.find((candidate) => candidate.key === seeded.platform)!
      campaignCounter += 1
      const view: MockCampaignView = {
        id: `camp_${campaignCounter}`,
        connection_id: seeded.id,
        platform: seeded.platform,
        external_id: `platform-${campaignCounter}`,
        revision: 1,
        campaign: {
          id: `camp_${campaignCounter}`,
          name: `${seeded.currency} push`,
          objective: fixture.capability_matrix.objectives[0]!,
          budget: {
            kind: fixture.capability_matrix.budget_types[0]!,
            amount: { amount_minor: 1500, currency: seeded.currency },
          },
          schedule: null,
          status: 'active',
          drift: { drifted: false, changed_fields: [] },
          ad_groups: [],
        },
      }
      campaigns.push(view)
    }
  }

  return {
    simulatePlatformEdit: (campaignId: string) => {
      const campaign = campaigns.find((candidate) => candidate.id === campaignId)
      if (!campaign) return
      campaign.revision += 1
      recordChange(campaign, 'platform', ['budget'], (state) => {
        state.budget = {
          kind: state.budget.kind,
          amount: {
            amount_minor: state.budget.amount.amount_minor * 5,
            currency: state.budget.amount.currency,
          },
        }
      })
      campaign.campaign.drift = { drifted: true, changed_fields: ['budget'] }
    },
  }
}
