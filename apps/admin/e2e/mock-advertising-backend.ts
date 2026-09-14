import type { Page } from '@playwright/test'
import type { BudgetPeriod } from '@sanvi/api-client'
import { AD_PLATFORM_FIXTURES, platformViewFixture } from '@sanvi/ui/test-fixtures'
import { BUDGET_PERIOD_DAILY, BUDGET_PERIOD_MONTHLY } from '../src/lib/budget-periods'

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

export interface MockBudgetCap {
  id: string
  tenant_id: string
  campaign_id: string | null
  period: BudgetPeriod
  amount: { amount_minor: number; currency: string }
  effective_currency: string
  declared_fx_basis: string | null
  fx_rate_date: string | null
  auto_pause: boolean
  auto_resume_on_rollover: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface MockBudgetAlert {
  id: string
  tenant_id: string
  campaign_id: string | null
  cap_id: string | null
  cap_amount: { amount_minor: number; currency: string }
  spend: { amount_minor: number; currency: string }
  condition: string
  threshold: number
  period: BudgetPeriod
  period_start: string
  auto_paused: boolean
  data_freshness: {
    is_settled: boolean
    is_stale: boolean
    lag_hours: number | null
    last_synced_at: string | null
  }
  created_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}

export interface AdvertisingMockControls {
  /** Simulates a native-tool edit on the platform side: the campaign drifts. */
  simulatePlatformEdit: (campaignId: string) => void
  /** How many times the tracking settings were PUT — the round-trip assertion. */
  settingsSavedCount: () => number
  /** How many times an audience refresh was POSTed. */
  audienceRefreshCount: () => number
  /** Marks a connection's ingestion stalled — the dashboard's "sync failed". */
  stallConnection: (connectionId?: string) => void
  /** A platform going **unreachable**: its ingestion stalls *and* its
      connection health records the failure — the degraded-mode screens name
      the platform and what is stale. `restorePlatform` undoes both so a
      spec can assert recovery without a reload. */
  unreachablePlatform: (connectionId?: string) => void
  restorePlatform: (connectionId?: string) => void
  /** Fires the tenant monthly cap's 100% threshold with auto-pause on:
      spend crosses the cap, a `settled_breach` alert is recorded with
      `auto_paused: true`, and the governed campaigns are paused with a
      system-sourced change entry (no human actor). */
  fireThresholdAutoPause: () => void
  /** The last CSV the export endpoint streamed (the spec asserts its columns). */
  lastExportCsv: () => string | undefined
  /** The last budget-cap PUT's body and path — the spec asserts the FX
      basis and the below-spend confirmation flag the UI must send. */
  lastCapPut: () => { path: string; body: Record<string, unknown> } | undefined
  /** How many alerts have been acknowledged through the API. */
  acknowledgedCount: () => number
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
    /** Flips the `advertising.conversion_tracking` entitlement off — the
        rollback/paused-state specs. */
    trackingDisabled?: boolean
    /** Flips the `advertising.dashboard` entitlement off — the TASK-016
        rollback/paused-state spec. */
    dashboardDisabled?: boolean
    /** Flips the `advertising.budget_guardrails` entitlement off — the
        TASK-017 rollback/paused-state spec. */
    budgetGuardrailsDisabled?: boolean
    /** Seeds caps in place (tenant monthly + one campaign monthly) with
        spend status to match: the tenant cap sits at 80%, the campaign cap
        is breached. Pairs with `seedTwoCampaigns`. */
    seedCaps?: boolean
    /** With `seedCaps`, seeds the tenant cap only — the highest-severity
        banner is then the 80% warning instead of a 100% breach. */
    seedCapsWarnOnly?: boolean
    /** Seeds a three-row alert history: an unacknowledged 80%, an
      unacknowledged breach, and an acknowledged stale-data warning. */
    seedAlerts?: boolean
    /** Adds two more captured conversions whose frozen consent snapshots
      exercise the other suppression categories: one with measurement
      consent simply not granted (`missing_consent`), one with a universal
      opt-out mechanism denying sale/share (`opted_out_sale_share`). The
      TASK-018 journey asserts both name their purpose and signal source. */
    seedConsentVariants?: boolean
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

  function seedConnectionRecord(
    id: string,
    fixture: { key: string },
    currency: string,
    timezone = 'Asia/Tokyo',
  ): void {
    connections.push({
      id,
      platform: fixture.key,
      external_account_id: '999-888',
      account_name: `Acme ${currency} Account`,
      currency,
      timezone,
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
    // Different timezone on purpose: the dashboard states differing
    // timezones rather than reconciling them, and this is what it states.
    seedConnectionRecord('conn_live_1', otherPlatformFixture(), 'USD', 'America/New_York')
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
          'advertising.budget.manage',
          'advertising.metrics.read',
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
  void page.route('**/api/v1/tenant/entitlements', (route) =>
    route.fulfill({
      json: [
        { feature: 'advertising.conversion_tracking', enabled: !options.trackingDisabled },
        { feature: 'advertising.dashboard', enabled: !options.dashboardDisabled },
        {
          feature: 'advertising.budget_guardrails',
          enabled: !options.budgetGuardrailsDisabled,
        },
      ],
    }),
  )

  // The catalog comes from the backend's own committed capability-matrix
  // fixtures — the mock spells no matrix values or platform keys itself
  // (the matrix-is-the-only-source gate enforces exactly that).
  void page.route('**/api/v1/tenant/ads/platforms', (route) =>
    route.fulfill({
      json: {
        platforms: AD_PLATFORM_FIXTURES.map((fixture) =>
          platformViewFixture(fixture, {
            connection_state: connections.some((connection) => connection.platform === fixture.key)
              ? 'connected'
              : 'not_connected',
          }),
        ),
      },
    }),
  )

  // The connect flow tracks which platform's OAuth was started: the
  // callback's pending view and the connection the POST creates both carry
  // it, so a second platform can connect through the same UI flow instead
  // of only seeded records existing for it. It defaults to `meta`, the
  // flow the earlier connection specs exercise.
  let pendingPlatform = 'meta'

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/start', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const platform = url.pathname.split('/')[6] ?? 'meta'
    const body = request.postDataJSON() as { redirect_uri?: string }
    pendingPlatform = platform
    // The backend builds the platform URL; here it points back at this
    // app's callback route carrying the platform's "authorization response".
    const redirectUri = body.redirect_uri ?? ''
    pendingCounter += 1
    const state = `e2e-state-${pendingCounter}`
    const authorizationUrl = `${redirectUri}?state=${state}&code=e2e-code`
    void route.fulfill({ json: { authorization_url: authorizationUrl, state } })
  })

  void page.route('**/api/v1/tenant/ads/connections/*/oauth/callback**', (route) => {
    void new URL(route.request().url()).pathname.split('/')[6]
    void route.fulfill({
      json: {
        id: `conn_pending_${pendingCounter}`,
        platform: pendingPlatform,
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
        platform: pendingPlatform,
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
      pendingPlatform = 'meta'
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

  // --- Conversion tracking (TASK-014) -------------------------------------
  //
  // A stateful mapping matrix the setup screen round-trips, a test-event
  // endpoint that answers what the capture pipeline "saw", and a
  // conversions list whose rows carry frozen consent snapshots.

  const trackingSettings: { tenant_id: string; mappings: Record<string, Record<string, string>> } =
    {
      tenant_id: 'dev-acme',
      mappings: { purchase: { meta: 'MetaPurchase123' } },
    }

  let settingsSaved = 0

  void page.route('**/api/v1/tenant/ads/tracking/settings', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: trackingSettings })
      return
    }
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as typeof trackingSettings
      trackingSettings.mappings = body.mappings ?? {}
      settingsSaved += 1
      await route.fulfill({ json: {} })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/tracking/test-event', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.fulfill({ json: {} })
      return
    }
    const body = request.postDataJSON() as {
      event_id: string
      event_name: string
      value?: number
      currency?: string
      order_ref?: string
      click_ids?: Record<string, string | null>
    }
    await route.fulfill({
      json: {
        captured: {
          id: '873698342314721281',
          tenant_id: 'dev-acme',
          event_id: body.event_id,
          name: body.event_name,
          occurred_at: new Date().toISOString(),
          click_ids: body.click_ids ?? { gclid: 'gclid-e2e-1' },
          hashed_identifiers: {},
          consent: {
            answers: { ads_measurement: 'allowed', sale_or_share: 'allowed' },
            jurisdiction: 'jp',
            purposes_asked: ['ads_measurement', 'sale_or_share'],
            resolver_version: '2026-08-01',
            signal_source: 'ui',
          },
          value:
            body.value !== undefined && body.currency
              ? { amount_minor: body.value, currency: body.currency }
              : null,
          value_source: body.value !== undefined ? 'client_reported' : null,
          order_ref: body.order_ref ?? null,
        },
        test: true,
      },
    })
  })

  const conversions = [
    {
      id: '873698342314721280',
      tenant_id: 'dev-acme',
      event_id: 'conv-e2e-permitted',
      name: 'purchase',
      occurred_at: '2026-09-04T09:00:00Z',
      click_ids: { gclid: 'gclid-e2e-permitted' },
      hashed_identifiers: {},
      consent: {
        answers: { ads_measurement: 'allowed' },
        jurisdiction: 'jp',
        purposes_asked: ['ads_measurement'],
        resolver_version: '2026-08-01',
        signal_source: 'ui',
      },
      upload_states: { meta: { status: 'uploaded', attempt_count: 1 } },
      value: { amount_minor: 4800, currency: 'JPY' },
      value_source: 'payment_record',
      order_ref: 'ord-permitted-1',
    },
    {
      id: '873698342314721282',
      tenant_id: 'dev-acme',
      event_id: 'conv-e2e-suppressed',
      name: 'purchase',
      occurred_at: '2026-09-05T09:00:00Z',
      click_ids: {},
      hashed_identifiers: {},
      consent: {
        answers: { ads_measurement: 'allowed', sale_or_share: 'denied' },
        jurisdiction: 'us-ca',
        purposes_asked: ['ads_measurement', 'sale_or_share'],
        resolver_version: '2026-08-01',
        signal_source: 'gpc',
      },
      upload_states: {},
      value: { amount_minor: 1200, currency: 'JPY' },
      value_source: 'payment_record',
      order_ref: 'ord-suppressed-1',
    },
    {
      id: '873698342314721284',
      tenant_id: 'dev-acme',
      event_id: 'conv-e2e-parked',
      name: 'add_payment_info',
      occurred_at: '2026-09-06T09:00:00Z',
      click_ids: { gclid: 'gclid-e2e-parked' },
      hashed_identifiers: {},
      consent: {
        answers: { ads_measurement: 'allowed' },
        jurisdiction: 'jp',
        purposes_asked: ['ads_measurement'],
        resolver_version: '2026-08-01',
        signal_source: 'ui',
      },
      upload_states: {
        meta: { status: 'parked', attempts: 5, reason: 'platform returned 500' },
      },
      value: { amount_minor: 900, currency: 'JPY' },
      value_source: 'payment_record',
      order_ref: 'ord-parked-1',
    },
    {
      id: '873698342314721286',
      tenant_id: 'dev-acme',
      event_id: 'conv-e2e-late',
      name: 'add_to_cart',
      occurred_at: '2026-09-07T09:00:00Z',
      click_ids: { gclid: 'gclid-e2e-late' },
      hashed_identifiers: {},
      consent: {
        answers: { ads_measurement: 'allowed' },
        jurisdiction: 'jp',
        purposes_asked: ['ads_measurement'],
        resolver_version: '2026-08-01',
        signal_source: 'ui',
      },
      upload_states: {
        meta: {
          status: 'failed',
          attempt_count: 2,
          reason: 'suppressed_late: consent withdrawn since capture',
        },
      },
      value: { amount_minor: 700, currency: 'JPY' },
      value_source: 'payment_record',
      order_ref: 'ord-late-1',
    },
  ]

  // The other suppression categories (TASK-018 journey): measurement
  // consent simply not granted — the consent *conversation*, not a browser
  // decision — and a universal opt-out mechanism denying sale/share. The
  // taxonomy derives both from the frozen snapshot: denied purposes plus
  // the signal source decide.
  if (options.seedConsentVariants) {
    conversions.push(
      {
        id: '873698342314721288',
        tenant_id: 'dev-acme',
        event_id: 'conv-e2e-consent-absent',
        name: 'purchase',
        occurred_at: '2026-09-08T09:00:00Z',
        click_ids: {},
        hashed_identifiers: {},
        consent: {
          answers: { ads_measurement: 'denied' },
          jurisdiction: 'jp',
          purposes_asked: ['ads_measurement'],
          resolver_version: '2026-08-01',
          signal_source: 'ui',
        },
        upload_states: {},
        value: { amount_minor: 3000, currency: 'JPY' },
        value_source: 'payment_record',
        order_ref: 'ord-consent-absent-1',
      },
      {
        id: '873698342314721290',
        tenant_id: 'dev-acme',
        event_id: 'conv-e2e-uoom',
        name: 'purchase',
        occurred_at: '2026-09-09T09:00:00Z',
        click_ids: {},
        hashed_identifiers: {},
        consent: {
          answers: { ads_measurement: 'allowed', sale_or_share: 'denied' },
          jurisdiction: 'us-ca',
          purposes_asked: ['ads_measurement', 'sale_or_share'],
          resolver_version: '2026-08-01',
          signal_source: 'uoom',
        },
        upload_states: {},
        value: { amount_minor: 2500, currency: 'JPY' },
        value_source: 'payment_record',
        order_ref: 'ord-uoom-1',
      },
    )
  }

  void page.route('**/api/v1/tenant/ads/conversions', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: conversions })
      return
    }
    await route.fulfill({ json: {} })
  })

  // --- Diagnostics & audiences (TASK-015) ----------------------------------
  //
  // The per-event diagnostics story, the parked-only retry (409 for
  // anything else — the backend is the compliance authority), and a small
  // stateful audience store.

  let audienceRefreshes = 0
  const audiences = [
    {
      id: 'aud_e2e_1',
      tenant_id: 'dev-acme',
      name: 'Purchasers 90d',
      platform: 'meta',
      status: { status: 'building' },
      included_identifiers: ['8f3a1c', '9d2e4b', 'c7a105'],
      external_ref: null,
      last_synced_at: null,
      created_at: '2026-09-06T08:00:00Z',
    },
    {
      id: 'aud_e2e_2',
      tenant_id: 'dev-acme',
      name: 'Repeat buyers',
      platform: 'meta',
      status: { status: 'active' },
      included_identifiers: ['5e8d20'],
      external_ref: 'meta-list-42',
      last_synced_at: '2026-09-07T10:30:00Z',
      created_at: '2026-09-05T08:00:00Z',
    },
  ]

  void page.route('**/api/v1/tenant/ads/conversions/*/diagnostics', async (route) => {
    const url = route.request().url()
    const id = url.split('/ads/conversions/')[1]?.split('/')[0] ?? ''
    const matched = conversions.find((candidate) => candidate.id === id) ?? conversions[0]
    await route.fulfill({
      json: { captured_at: '2026-09-07T09:00:05Z', event: matched },
    })
  })

  void page.route('**/api/v1/tenant/ads/conversions/*/retry', async (route) => {
    const request = route.request()
    const url = request.url()
    const id = url.split('/ads/conversions/')[1]?.split('/')[0] ?? ''
    const matched = conversions.find((candidate) => candidate.id === id)
    const parked = matched?.upload_states as Record<string, Record<string, unknown>> | undefined
    if (!matched || !parked || !Object.values(parked).some((s) => s.status === 'parked')) {
      await route.fulfill({ status: 409, json: { title: 'advertising/retry-refused' } })
      return
    }
    for (const state of Object.values(parked)) {
      if (state.status === 'parked') {
        delete state.reason
        delete state.attempts
        state.status = 'pending'
        state.attempt_count = 6
      }
    }
    await route.fulfill({ json: matched })
  })

  void page.route('**/api/v1/tenant/ads/audiences/*/refresh', async (route) => {
    const request = route.request()
    const url = request.url()
    const id = url.split('/ads/audiences/')[1]?.split('/')[0] ?? ''
    const matched = audiences.find((candidate) => candidate.id === id)
    if (!matched) {
      await route.fulfill({ status: 404, json: { title: 'audience-not-found' } })
      return
    }
    audienceRefreshes += 1
    matched.status = { status: 'active' }
    matched.last_synced_at = '2026-09-08T10:00:00Z'
    // The refresh pass removed the opted-out subject's hash.
    matched.included_identifiers = matched.included_identifiers.slice(0, 2)
    await route.fulfill({ json: matched })
  })

  void page.route('**/api/v1/tenant/ads/audiences', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: audiences })
      return
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { name: string; platform: string }
      const created = {
        id: `aud_e2e_new_${audiences.length + 1}`,
        tenant_id: 'dev-acme',
        name: body.name,
        platform: body.platform,
        status: { status: 'building' },
        included_identifiers: [] as string[],
        external_ref: null,
        last_synced_at: null,
        created_at: new Date().toISOString(),
      }
      audiences.unshift(created)
      await route.fulfill({ json: created, status: 201 })
      return
    }
    await route.fulfill({ json: {} })
  })

  // --- Performance metrics (TASK-016) --------------------------------------
  //
  // Deterministic per-connection rollups generated relative to *now*, so the
  // dashboard's default last-30-days range always contains them. The summary
  // is one row per currency (the contract refuses cross-currency totals),
  // export streams CSV with both ROAS columns labelled, and freshness
  // carries the backend's `stalled` flag — the dashboard's "sync failed"
  // state renders from it, never from a clock guess.
  const stalledConnectionIds = new Set<string>()
  let exportCsv: string | undefined

  function isoDaysAgo(days: number): string {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - days)
    return date.toISOString().slice(0, 10)
  }

  interface MockMetricDay {
    spendMinor: number
    valueMinor: number
    revenueMinor: number
    conversions: number
    clicks: number
    impressions: number
  }

  function metricDaysFor(
    connection: MockAdConnection,
    campaignId: string,
  ): Map<string, MockMetricDay> {
    const days = new Map<string, MockMetricDay>()
    const base = connection.id.length + campaignId.length
    for (let ago = 0; ago < 3; ago += 1) {
      days.set(isoDaysAgo(ago), {
        spendMinor: base * 100,
        valueMinor: base * 260,
        revenueMinor: base * 200,
        conversions: 2,
        clicks: base,
        impressions: base * 30,
      })
    }
    return days
  }

  function buildMetricRows(): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    const sources = campaigns.length > 0 ? campaigns : []
    for (const connection of connections) {
      const connectionCampaigns =
        sources.length > 0 ? sources.filter((view) => view.connection_id === connection.id) : []
      const targets =
        connectionCampaigns.length > 0
          ? connectionCampaigns.map((view) => ({ id: view.id, name: view.campaign.name }))
          : [{ id: `${connection.id}_rollup`, name: `${connection.currency} rollup` }]
      for (const target of targets) {
        const days = metricDaysFor(connection, target.id)
        for (const [date, day] of days) {
          const ago = Math.round(
            (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${isoDaysAgo(0)}T00:00:00Z`)) /
              86_400_000,
          )
          rows.push({
            campaign_id: target.id,
            clicks: day.clicks,
            conversion_value: { amount_minor: day.valueMinor, currency: connection.currency },
            conversions: day.conversions,
            date,
            impressions: day.impressions,
            platform: connection.platform,
            rendered_spend: null,
            restating: ago <= 1,
            roas_platform: day.valueMinor / day.spendMinor,
            roas_sanvi: day.revenueMinor / day.spendMinor,
            sanvi_revenue: { amount_minor: day.revenueMinor, currency: connection.currency },
            spend: { amount_minor: day.spendMinor, currency: connection.currency },
          })
        }
      }
    }
    return rows
  }

  function buildSummaryRows(): Record<string, unknown>[] {
    const rows = buildMetricRows() as {
      spend: { amount_minor: number; currency: string }
      conversion_value: { amount_minor: number }
      sanvi_revenue: { amount_minor: number }
      conversions: number
      clicks: number
      impressions: number
      restating: boolean
    }[]
    const byCurrency = new Map<
      string,
      {
        spend: number
        value: number
        revenue: number
        conversions: number
        clicks: number
        impressions: number
        restating: boolean
      }
    >()
    for (const row of rows) {
      const bucket = byCurrency.get(row.spend.currency) ?? {
        spend: 0,
        value: 0,
        revenue: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
        restating: false,
      }
      bucket.spend += row.spend.amount_minor
      bucket.value += row.conversion_value.amount_minor
      bucket.revenue += row.sanvi_revenue.amount_minor
      bucket.conversions += row.conversions
      bucket.clicks += row.clicks
      bucket.impressions += row.impressions
      bucket.restating = bucket.restating || row.restating
      byCurrency.set(row.spend.currency, bucket)
    }
    return [...byCurrency.entries()].map(([currency, bucket]) => ({
      clicks: bucket.clicks,
      conversion_value: { amount_minor: bucket.value, currency },
      conversions: bucket.conversions,
      currency,
      impressions: bucket.impressions,
      restating: bucket.restating,
      roas_platform: bucket.value / bucket.spend,
      roas_sanvi: bucket.revenue / bucket.spend,
      sanvi_revenue: { amount_minor: bucket.revenue, currency },
      spend: { amount_minor: bucket.spend, currency },
    }))
  }

  void page.route('**/api/v1/tenant/ads/metrics/freshness', async (route) => {
    await route.fulfill({
      json: {
        connections: connections.map((connection) => ({
          connection_id: connection.id,
          platform: connection.platform,
          last_ingested_at: stalledConnectionIds.has(connection.id)
            ? `${isoDaysAgo(6)}T00:00:00Z`
            : `${isoDaysAgo(0)}T06:00:00Z`,
          lag_hours: stalledConnectionIds.has(connection.id) ? 150 : 4,
          stalled: stalledConnectionIds.has(connection.id),
        })),
      },
    })
  })

  void page.route('**/api/v1/tenant/ads/metrics/export**', async (route) => {
    const rows = buildMetricRows()
    const header =
      'date,campaign_id,platform,currency,impressions,clicks,conversions,conversion_value_minor,spend_minor,sanvi_revenue_minor,roas_platform,roas_sanvi,restating'
    const body = rows
      .map((row) => {
        const record = row as Record<string, unknown>
        return [
          record.date,
          record.campaign_id,
          record.platform,
          (record.spend as { currency: string }).currency,
          record.impressions,
          record.clicks,
          record.conversions,
          (record.conversion_value as { amount_minor: number }).amount_minor,
          (record.spend as { amount_minor: number }).amount_minor,
          (record.sanvi_revenue as { amount_minor: number }).amount_minor,
          record.roas_platform,
          record.roas_sanvi,
          record.restating,
        ].join(',')
      })
      .join('\n')
    exportCsv = `${header}\n${body}\n`
    await route.fulfill({
      body: exportCsv,
      headers: { 'content-type': 'text/csv' },
    })
  })

  void page.route('**/api/v1/tenant/ads/metrics/summary**', async (route) => {
    const url = new URL(route.request().url())
    const compare = url.searchParams.get('compare_to')
    await route.fulfill({
      json: {
        current: buildSummaryRows(),
        compared: compare ? buildSummaryRows() : null,
      },
    })
  })

  void page.route('**/api/v1/tenant/ads/metrics*', async (route) => {
    // `*` does not match '/', so this answers the bare rollup endpoint only —
    // summary/freshness/export above keep their subpaths.
    await route.fulfill({ json: { rows: buildMetricRows() } })
  })

  // --- Budget guardrails (TASK-017) ---------------------------------------
  //
  // A stateful cap store with the backend's guard rails modelled: dry_run
  // answers the evaluation without writing, a cap below the period's spend
  // is a 409 until `confirm_below_current_spend` arrives, and spend-status
  // supplies every figure the screens render (percentage included — the UI
  // must not recompute them). Registered after the campaigns routes so the
  // campaign budget-cap subpath is answered here, not by `campaigns/**`.

  const budgetCaps: MockBudgetCap[] = []
  const budgetAlerts: MockBudgetAlert[] = []
  let capCounter = 0
  let alertCounter = 0
  let acknowledgedCount = 0
  let lastCapPut: { path: string; body: Record<string, unknown> } | undefined
  // Set by `fireThresholdAutoPause`: the tenant monthly cap is over 100%
  // from here on, so spend-status and any dry run read the breached basis.
  let autoPauseFired = false

  function capScopeStale(campaignId: string | null): boolean {
    if (campaignId) {
      const campaign = campaigns.find((candidate) => candidate.id === campaignId)
      const connection = connections.find((entry) => entry.id === campaign?.connection_id)
      return connection ? stalledConnectionIds.has(connection.id) : false
    }
    return connections.some((entry) => stalledConnectionIds.has(entry.id))
  }

  function capSpendFor(
    campaignId: string | null,
    period: BudgetPeriod,
    _currency?: string,
  ): {
    spend: number
    settled: number
    provisional: number
    projected: number
  } {
    if (autoPauseFired && campaignId === null && period === 'monthly') {
      // Past the 50,000 tenant cap: 104% of it, settled — the state a
      // fired threshold_100 with auto-pause leaves behind.
      return { spend: 52_000, settled: 52_000, provisional: 0, projected: 70_000 }
    }
    return campaignId === null
      ? period === 'monthly'
        ? { spend: 40_000, settled: 34_000, provisional: 6_000, projected: 62_000 }
        : { spend: 3_000, settled: 1_500, provisional: 1_500, projected: 9_000 }
      : period === 'monthly'
        ? { spend: 21_000, settled: 18_000, provisional: 3_000, projected: 30_000 }
        : { spend: 2_100, settled: 1_000, provisional: 1_100, projected: 3_000 }
  }

  function spendStatusItem(
    cap: MockBudgetCap | null,
    campaignId: string | null,
    period: BudgetPeriod,
  ) {
    const stale = capScopeStale(campaignId)
    const figures = capSpendFor(campaignId, period)
    const percentage =
      cap && cap.amount.amount_minor > 0 ? (figures.spend / cap.amount.amount_minor) * 100 : null
    return {
      scope: campaignId === null ? 'tenant' : `campaign:${campaignId}`,
      campaign_id: campaignId ?? undefined,
      period,
      cap,
      spend_to_date: { amount_minor: figures.spend, currency: 'JPY' },
      settled_spend: { amount_minor: figures.settled, currency: 'JPY' },
      provisional_spend: { amount_minor: figures.provisional, currency: 'JPY' },
      provisional_lower_bound: {
        amount_minor: figures.settled + Math.round(figures.provisional * 0.8),
        currency: 'JPY',
      },
      projected_spend: { amount_minor: figures.projected, currency: 'JPY' },
      percentage,
      data_freshness: {
        is_settled: period === BUDGET_PERIOD_DAILY && !stale,
        is_stale: stale,
        lag_hours: stale ? 150 : 4,
        last_synced_at: stale ? `${isoDaysAgo(6)}T00:00:00Z` : `${isoDaysAgo(0)}T06:00:00Z`,
      },
      actions_configured: {
        auto_pause: cap?.auto_pause ?? false,
        auto_resume_on_rollover: cap?.auto_resume_on_rollover ?? false,
        threshold_80: 'notify',
        threshold_100: cap?.auto_pause ? 'pause' : 'notify',
      },
      unconvertible_spend_currencies: [],
    }
  }

  if (options.seedCaps) {
    capCounter += 1
    budgetCaps.push({
      id: `cap_${capCounter}`,
      tenant_id: 'dev-acme',
      campaign_id: null,
      period: 'monthly',
      amount: { amount_minor: 50_000, currency: 'JPY' },
      effective_currency: 'JPY',
      declared_fx_basis: null,
      fx_rate_date: null,
      auto_pause: true,
      auto_resume_on_rollover: false,
      version: 1,
      created_at: `${isoDaysAgo(20)}T00:00:00Z`,
      updated_at: `${isoDaysAgo(20)}T00:00:00Z`,
    })
    const firstCampaign = campaigns[0]
    if (firstCampaign && !options.seedCapsWarnOnly) {
      capCounter += 1
      budgetCaps.push({
        id: `cap_${capCounter}`,
        tenant_id: 'dev-acme',
        campaign_id: firstCampaign.id,
        period: 'monthly',
        amount: { amount_minor: 20_000, currency: 'JPY' },
        effective_currency: 'JPY',
        declared_fx_basis: null,
        fx_rate_date: null,
        auto_pause: false,
        auto_resume_on_rollover: false,
        version: 1,
        created_at: `${isoDaysAgo(10)}T00:00:00Z`,
        updated_at: `${isoDaysAgo(10)}T00:00:00Z`,
      })
    }
  }

  if (options.seedAlerts) {
    const rows: Array<Partial<MockBudgetAlert> & { condition: string }> = [
      {
        condition: 'threshold80',
        threshold: 80,
        campaign_id: null,
        cap_id: 'cap_1',
        cap_amount: { amount_minor: 50_000, currency: 'JPY' },
        spend: { amount_minor: 40_000, currency: 'JPY' },
        period: 'monthly',
        auto_paused: false,
        created_at: `${isoDaysAgo(0)}T07:00:00Z`,
        acknowledged_at: null,
        data_freshness: {
          is_settled: false,
          is_stale: false,
          lag_hours: 4,
          last_synced_at: `${isoDaysAgo(0)}T06:00:00Z`,
        },
      },
      {
        condition: 'settled_breach',
        threshold: 100,
        campaign_id: campaigns[0]?.id ?? null,
        cap_id: 'cap_2',
        cap_amount: { amount_minor: 20_000, currency: 'JPY' },
        spend: { amount_minor: 21_000, currency: 'JPY' },
        period: 'monthly',
        auto_paused: false,
        created_at: `${isoDaysAgo(1)}T09:00:00Z`,
        acknowledged_at: null,
        data_freshness: {
          is_settled: true,
          is_stale: false,
          lag_hours: 4,
          last_synced_at: `${isoDaysAgo(1)}T06:00:00Z`,
        },
      },
      {
        condition: 'stale_data_warning',
        threshold: 80,
        campaign_id: null,
        cap_id: null,
        cap_amount: { amount_minor: 5_000, currency: 'JPY' },
        spend: { amount_minor: 3_000, currency: 'JPY' },
        period: BUDGET_PERIOD_DAILY,
        auto_paused: false,
        created_at: `${isoDaysAgo(2)}T12:00:00Z`,
        acknowledged_at: `${isoDaysAgo(1)}T08:00:00Z`,
        acknowledged_by: me.user_id,
        data_freshness: {
          is_settled: false,
          is_stale: true,
          lag_hours: 150,
          last_synced_at: `${isoDaysAgo(6)}T00:00:00Z`,
        },
      },
    ]
    for (const row of rows) {
      alertCounter += 1
      budgetAlerts.push({
        id: `alert_${alertCounter}`,
        tenant_id: 'dev-acme',
        campaign_id: row.campaign_id ?? null,
        cap_id: row.cap_id ?? null,
        cap_amount: row.cap_amount!,
        spend: row.spend!,
        condition: row.condition,
        threshold: row.threshold ?? 80,
        period: row.period ?? 'monthly',
        period_start:
          row.period === BUDGET_PERIOD_DAILY ? isoDaysAgo(2) : `${isoDaysAgo(0).slice(0, 8)}01`,
        auto_paused: row.auto_paused ?? false,
        data_freshness: row.data_freshness!,
        created_at: row.created_at!,
        acknowledged_at: row.acknowledged_at ?? null,
        acknowledged_by: row.acknowledged_by ?? null,
      })
    }
  }

  async function handleCapPut(
    path: string,
    campaignId: string | null,
    body: Record<string, unknown>,
  ) {
    lastCapPut = { path, body }
    const period = (body.period as BudgetPeriod) ?? BUDGET_PERIOD_MONTHLY
    const amount = (body.amount ?? {}) as { amount_minor?: number; currency?: string }
    const amountMinor = Number(amount.amount_minor ?? 0)
    const currency = amount.currency ?? 'JPY'

    if (!amountMinor || amountMinor <= 0) {
      return { status: 400, json: { type: 'about:blank', title: 'Bad request', status: 400 } }
    }

    const spend = capSpendFor(campaignId, period, currency).spend
    if (body.dry_run === true) {
      const percentage = (spend / amountMinor) * 100
      const wouldBreach80 = percentage >= 80
      const wouldBreach100 = percentage >= 100
      return {
        status: 200,
        json: {
          scope: campaignId === null ? 'tenant' : `campaign:${campaignId}`,
          period,
          cap_amount: { amount_minor: amountMinor, currency },
          current_spend: { amount_minor: spend, currency },
          percentage,
          would_breach_80: wouldBreach80,
          would_breach_100: wouldBreach100,
          would_auto_pause: body.auto_pause === true && wouldBreach100,
          condition: wouldBreach100 ? 'breach' : wouldBreach80 ? 'warning_80' : 'ok',
        },
      }
    }

    if (amountMinor < spend && body.confirm_below_current_spend !== true) {
      return {
        status: 409,
        json: {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'New cap is below current period spend and confirmation is required',
        },
      }
    }

    const existing = budgetCaps.find(
      (candidate) => candidate.campaign_id === campaignId && candidate.period === period,
    )
    if (existing) {
      existing.amount = { amount_minor: amountMinor, currency }
      existing.effective_currency = currency
      existing.declared_fx_basis = (body.declared_fx_basis as string | undefined) ?? null
      existing.fx_rate_date = (body.fx_rate_date as string | undefined) ?? null
      existing.auto_pause = body.auto_pause === true
      existing.auto_resume_on_rollover = body.auto_resume_on_rollover === true
      existing.version += 1
      existing.updated_at = new Date().toISOString()
      return { status: 200, json: existing }
    }
    capCounter += 1
    const created: MockBudgetCap = {
      id: `cap_${capCounter}`,
      tenant_id: 'dev-acme',
      campaign_id: campaignId,
      period,
      amount: { amount_minor: amountMinor, currency },
      effective_currency: currency,
      declared_fx_basis: (body.declared_fx_basis as string | undefined) ?? null,
      fx_rate_date: (body.fx_rate_date as string | undefined) ?? null,
      auto_pause: body.auto_pause === true,
      auto_resume_on_rollover: body.auto_resume_on_rollover === true,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    budgetCaps.push(created)
    return { status: 200, json: created }
  }

  void page.route('**/api/v1/tenant/ads/budget-caps', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { caps: budgetCaps } })
      return
    }
    if (request.method() === 'PUT') {
      const result = await handleCapPut(
        '/api/v1/tenant/ads/budget-caps',
        null,
        (request.postDataJSON() ?? {}) as Record<string, unknown>,
      )
      await route.fulfill({ status: result.status, json: result.json })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/campaigns/*/budget-cap*', async (route) => {
    const request = route.request()
    const match = request.url().match(/\/ads\/campaigns\/([^/]+)\/budget-cap/)
    const campaignId = match?.[1] ?? null
    if (request.method() === 'GET') {
      const period = new URL(request.url()).searchParams.get('period') ?? 'monthly'
      const cap = budgetCaps.find(
        (candidate) => candidate.campaign_id === campaignId && candidate.period === period,
      )
      if (!cap) {
        await route.fulfill({
          status: 404,
          json: { type: 'about:blank', title: 'Not found', status: 404 },
        })
        return
      }
      await route.fulfill({ json: cap })
      return
    }
    if (request.method() === 'PUT') {
      const result = await handleCapPut(
        request.url(),
        campaignId,
        (request.postDataJSON() ?? {}) as Record<string, unknown>,
      )
      await route.fulfill({ status: result.status, json: result.json })
      return
    }
    await route.fulfill({ json: {} })
  })

  void page.route('**/api/v1/tenant/ads/spend-status*', async (route) => {
    const periodParam = new URL(route.request().url()).searchParams.get('period')
    const periods: BudgetPeriod[] =
      periodParam === BUDGET_PERIOD_DAILY || periodParam === BUDGET_PERIOD_MONTHLY
        ? [periodParam]
        : [BUDGET_PERIOD_DAILY, BUDGET_PERIOD_MONTHLY]
    const items: ReturnType<typeof spendStatusItem>[] = []
    for (const period of periods) {
      const tenantCap =
        budgetCaps.find(
          (candidate) => candidate.campaign_id === null && candidate.period === period,
        ) ?? null
      items.push(spendStatusItem(tenantCap, null, period))
      for (const campaign of campaigns) {
        const campaignCap =
          budgetCaps.find(
            (candidate) => candidate.campaign_id === campaign.id && candidate.period === period,
          ) ?? null
        items.push(spendStatusItem(campaignCap, campaign.id, period))
      }
    }
    await route.fulfill({ json: { tenant_id: 'dev-acme', timezone: 'Asia/Tokyo', items } })
  })

  void page.route('**/api/v1/tenant/ads/budget-alerts*', async (route) => {
    const query = new URL(route.request().url()).searchParams
    const unacknowledgedOnly = query.get('unacknowledged_only') === 'true'
    const alerts = unacknowledgedOnly
      ? budgetAlerts.filter((alert) => alert.acknowledged_at === null)
      : budgetAlerts
    await route.fulfill({ json: { alerts } })
  })

  void page.route('**/api/v1/tenant/ads/budget-alerts/*/acknowledge', async (route) => {
    const match = route
      .request()
      .url()
      .match(/\/budget-alerts\/([^/]+)\/acknowledge/)
    const alert = budgetAlerts.find((candidate) => candidate.id === match?.[1])
    if (!alert) {
      await route.fulfill({
        status: 404,
        json: { type: 'about:blank', title: 'Not found', status: 404 },
      })
      return
    }
    if (alert.acknowledged_at === null) acknowledgedCount += 1
    alert.acknowledged_at = new Date().toISOString()
    alert.acknowledged_by = me.user_id
    await route.fulfill({ json: alert })
  })

  function setConnectionUnreachable(id: string, unreachable: boolean): void {
    if (unreachable) stalledConnectionIds.add(id)
    else stalledConnectionIds.delete(id)
    const connection = connections.find((candidate) => candidate.id === id)
    if (connection) {
      connection.health.last_error = unreachable ? 'platform unreachable (simulated)' : null
      connection.health.can_sync = !unreachable
    }
  }

  return {
    settingsSavedCount: () => settingsSaved,
    audienceRefreshCount: () => audienceRefreshes,
    stallConnection: (connectionId?: string) => {
      stalledConnectionIds.add(connectionId ?? connections[0]?.id ?? 'conn_live_0')
    },
    unreachablePlatform: (connectionId?: string) => {
      setConnectionUnreachable(connectionId ?? connections[0]?.id ?? 'conn_live_0', true)
    },
    restorePlatform: (connectionId?: string) => {
      setConnectionUnreachable(connectionId ?? connections[0]?.id ?? 'conn_live_0', false)
    },
    fireThresholdAutoPause: () => {
      autoPauseFired = true
      const tenantCap =
        budgetCaps.find(
          (candidate) => candidate.campaign_id === null && candidate.period === 'monthly',
        ) ?? null
      alertCounter += 1
      budgetAlerts.unshift({
        id: `alert_${alertCounter}`,
        tenant_id: 'dev-acme',
        campaign_id: null,
        cap_id: tenantCap?.id ?? null,
        cap_amount: tenantCap?.amount ?? { amount_minor: 50_000, currency: 'JPY' },
        spend: { amount_minor: 52_000, currency: 'JPY' },
        condition: 'settled_breach',
        threshold: 100,
        period: 'monthly',
        period_start: `${isoDaysAgo(0).slice(0, 8)}01`,
        auto_paused: true,
        data_freshness: {
          is_settled: true,
          is_stale: false,
          lag_hours: 4,
          last_synced_at: `${isoDaysAgo(0)}T06:00:00Z`,
        },
        created_at: new Date().toISOString(),
        acknowledged_at: null,
        acknowledged_by: null,
      })
      // The guardrail itself pauses delivery — the change is Sanvi-side and
      // has no human actor, which the change log renders as an automated
      // Sanvi action rather than attributing it to a person.
      for (const campaign of campaigns) {
        if (campaign.campaign.status !== 'active') continue
        campaign.revision += 1
        recordChange(campaign, 'sanvi', ['status'], (state) => {
          state.status = 'paused'
        })
        const recorded = campaignChanges[0]
        if (recorded) {
          recorded.actor_id = null
          recorded.metadata = { automated: 'budget_guardrail' }
        }
      }
    },
    lastExportCsv: () => exportCsv,
    lastCapPut: () => lastCapPut,
    acknowledgedCount: () => acknowledgedCount,
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
