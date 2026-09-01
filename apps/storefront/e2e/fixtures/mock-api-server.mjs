#!/usr/bin/env node
/**
 * A tiny stand-in for the backend endpoints the storefront needs, keyed by
 * the incoming `Host` header exactly like the real handler
 * (`sanvi-backend`'s `public_tenant_context`). Started as Playwright's first
 * `webServer` entry (see `playwright.config.ts`) — deliberately plain `.mjs`,
 * not `.ts`, because it has to run as a raw `node` CLI command with no build
 * step, on whatever Node version CI happens to pin.
 *
 * Playwright starts `webServer` entries and waits for each one's own `url`
 * to answer before moving on to the next entry, then to tests — it does
 * *not* run `globalSetup` before `webServer` (verified empirically: a
 * `globalSetup` that starts this same mock never got a chance to run before
 * the storefront's own `webServer` entry exhausted its 60s readiness
 * timeout, since `hooks.server.ts` 500s on every request without a backend
 * to resolve tenants against). A second `webServer` entry, not
 * `globalSetup`, is what actually gets this backend up first.
 *
 * Host keys must match the preview server's actual `host:port` — see
 * `playwright.config.ts`'s `use.baseURL` / the storefront `webServer` entry
 * (port 4174) and `tenancy.spec.ts`'s `*.localhost` navigations.
 * `*.localhost` resolves to loopback without any `/etc/hosts` entry
 * (RFC 6761) — that's what makes driving three different "hosts" against
 * one local server possible. (Playwright/Chromium refuses to let a test
 * override the `Host` header directly — verified:
 * `page.setExtraHTTPHeaders({ Host: ... })` throws `net::ERR_INVALID_ARGUMENT`.)
 *
 * Phase 05 adds the privacy surface: directives, notice, notice-at-collection,
 * consents, opt-out, DSRs, download, appeal, sub-processors, metrics. State is
 * in-memory and keyed by the `sanvi_device` cookie (the rotating device
 * reference the consent store sets), plus a `mock_jurisdiction` cookie that
 * switches the resolved jurisdiction between `eu` (opt-in) and `us-ca`
 * (notice-and-opt-out) — the same components must render both.
 *
 * `/__privacy/log` returns every mocked-API request as JSON lines so specs
 * can make network-level assertions ("no non-essential script loaded before
 * consent" is only provable at the network layer).
 */
import { createServer } from 'node:http'

const PORT = 8090

const TENANTS = {
  'localhost:4174': {
    tenant_id: '11111111-1111-1111-1111-111111111111',
    slug: 'default',
    display_name: 'Default Tenant',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'acme.localhost:4174': {
    tenant_id: '22222222-2222-2222-2222-222222222222',
    slug: 'acme',
    display_name: 'Acme Corporation',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'suspended.localhost:4174': {
    tenant_id: '33333333-3333-3333-3333-333333333333',
    slug: 'suspended-co',
    display_name: 'Suspended Co',
    status: 'suspended',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'chromium.localhost:4174': {
    tenant_id: '44444444-4444-4444-4444-444444444444',
    slug: 'chromium',
    display_name: 'Chromium Tenant',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'webkit.localhost:4174': {
    tenant_id: '55555555-5555-5555-5555-555555555555',
    slug: 'webkit',
    display_name: 'Webkit Tenant',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'mobile-chrome.localhost:4174': {
    tenant_id: '66666666-6666-6666-6666-666666666666',
    slug: 'mobile-chrome',
    display_name: 'Mobile Chrome Tenant',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
}

const INITIAL_THEME = {
  theme_key: 'dawn',
  theme_version: '1.0.0',
  theme_api: '^1.0.0',
  capabilities: [],
  tokens: {
    'color.brand.primary': { $value: '#0066cc', $type: 'color' },
  },
  css_vars: ':root { --sanvi-color-brand-primary: #0066cc; }',
  layouts: {
    'storefront.home': {
      slots: ['header', 'hero', 'footer'],
    },
  },
  fonts: [
    {
      family: 'Inter',
      src: '/fonts/inter.woff2',
      preload: true,
    },
  ],
  theme_assets: { screenshots: [] },
  brand_assets: {},
  revision: 1,
  locale: 'en',
  etag: '"etag-mock-1"',
}

const themes = new Map()

function getThemeState(req) {
  const tenantId = req?.headers?.['x-tenant-id']
  const host = (req?.headers?.host || '').split(':')[0]
  const key = tenantId || (host && host !== 'localhost' && host !== '127.0.0.1' ? host : 'default')
  if (!themes.has(key)) {
    themes.set(key, {
      themeRevision: 1,
      currentTheme: { ...INITIAL_THEME, tokens: { ...INITIAL_THEME.tokens } },
      previousTheme: null,
      currentDraft: {
        spec: {
          key: 'dawn',
          version: '1.0.0',
          capabilities: ['tokens', 'layouts'],
          fonts: [],
          layouts: {},
          overridable: [],
        },
        theme: {
          theme_key: 'dawn',
          version: '1.0.0',
          state: 'draft',
          revision: 1,
          token_overrides: {},
          layout_overrides: {},
          assets: {},
          custom_css: null,
          updated_at: new Date().toISOString(),
        },
      },
    })
  }
  return themes.get(key)
}

const NOTICE_VERSION = '2026.1'

/** Jurisdiction profiles — mirrors the platform's phase-05 seed data. */
const JURISDICTIONS = {
  eu: {
    code: 'eu',
    regime: 'gdpr',
    consent_model: 'opt_in',
    response_days: 30,
    honours_universal_opt_out: false,
    appeal_window_days: null,
  },
  'us-ca': {
    code: 'us-ca',
    regime: 'us_state',
    consent_model: 'notice_and_opt_out',
    response_days: 45,
    honours_universal_opt_out: true,
    appeal_window_days: 45,
  },
}

const NOTICE = {
  notice_version: NOTICE_VERSION,
  backup_retention_days: 35,
  jurisdictions: Object.values(JURISDICTIONS),
  retention: [
    { category: 'Invoices', period_days: 2555, action: 'archive' },
    { category: 'Consent records', period_days: 1825, action: 'archive' },
    { category: 'Profile and preferences', period_days: 30, action: 'delete' },
  ],
  subprocessors: [{ name: 'Stripe' }, { name: 'Mailjet' }],
}

const NOTICE_AT_COLLECTION = {
  notice_version: NOTICE_VERSION,
  categories: ['Contact details', 'Order history', 'Usage data'],
  purposes: ['essential', 'analytics', 'ads_measurement'],
  retention_summary: NOTICE.retention,
  sale_or_share: true,
  sensitive_pi: false,
  targeted_advertising: true,
  opt_out_effective_business_days: 2,
}

const SUBPROCESSORS = [
  {
    name: 'Stripe',
    role: 'processor',
    location: 'Ireland',
    purpose: 'Payments',
    transfer_mechanism: 'sccs',
    added_at: '2026-01-15T00:00:00Z',
    removed_at: null,
    dpa_url: null,
    contract_terms: null,
  },
  {
    name: 'Mailjet',
    role: 'processor',
    location: 'France',
    purpose: 'Transactional email',
    transfer_mechanism: 'none',
    added_at: '2026-02-01T00:00:00Z',
    removed_at: null,
    dpa_url: null,
    contract_terms: null,
  },
]

const METRICS = [
  {
    jurisdiction: 'eu',
    kind: 'export',
    received: 12,
    complied: 11,
    denied: 1,
    median_days: 6.5,
    year: 2025,
  },
  {
    jurisdiction: 'us-ca',
    kind: 'erasure',
    received: 7,
    complied: 7,
    denied: 0,
    median_days: 4,
    year: 2025,
  },
]

/** All consentable purposes except the sale/share family — EU defaults deny everything. */
const EU_DIRECTIVES = [
  'analytics',
  'marketing_email',
  'ads_personalisation',
  'ads_measurement',
  'session_replay',
  'sale_or_share',
  'targeted_advertising',
  'profiling_significant_effects',
  'sensitive_pi_use',
].map((purpose) => ({
  purpose,
  state: 'denied',
  source: 'default',
  effective_at: '2026-01-01T00:00:00Z',
  jurisdiction: 'eu',
  notice_version: NOTICE_VERSION,
  superseded_at: null,
}))

/** US defaults: everything allowed until opted out. */
const US_DIRECTIVES = [
  'analytics',
  'marketing_email',
  'ads_personalisation',
  'ads_measurement',
  'session_replay',
  'sale_or_share',
  'targeted_advertising',
  'profiling_significant_effects',
  'sensitive_pi_use',
].map((purpose) => ({
  purpose,
  state: 'allowed',
  source: 'default',
  effective_at: '2026-01-01T00:00:00Z',
  jurisdiction: 'us-ca',
  notice_version: NOTICE_VERSION,
  superseded_at: null,
}))

/** Per-device in-memory state: directive overrides + DSRs. */
const subjects = new Map()
const requestLog = []

function subjectFor(cookies) {
  const key = cookies.get('sanvi_device') ?? 'anonymous-device'
  if (!subjects.has(key)) subjects.set(key, { overrides: new Map(), dsrs: new Map() })
  return subjects.get(key)
}

function parseCookies(req) {
  const header = req.headers.cookie ?? ''
  return new Map(
    header
      .split(';')
      .filter((part) => part.trim().length > 0)
      .map((part) => {
        const index = part.indexOf('=')
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function jurisdictionFor(cookies) {
  const code = cookies.get('mock_jurisdiction') === 'us-ca' ? 'us-ca' : 'eu'
  return { code, profile: JURISDICTIONS[code] }
}

function snapshotFor(cookies) {
  const { code } = jurisdictionFor(cookies)
  const subject = subjectFor(cookies)
  const base = code === 'us-ca' ? US_DIRECTIVES : EU_DIRECTIVES
  const directives = base.map((directive) => {
    const override = subject.overrides.get(directive.purpose)
    if (!override) return { ...directive, jurisdiction: code }
    return {
      ...directive,
      state: override.state,
      source: override.source,
      jurisdiction: code,
      effective_at: '2026-01-02T00:00:00Z',
    }
  })
  return {
    snapshot: {
      subject: { key: 'mock-subject', kind: 'device', identifiers: [], tenant_id: null },
      jurisdiction: code,
      directives,
      honours_universal_opt_out: code === 'us-ca',
      minor_opt_in_age: null,
    },
  }
}

const PREVIEW_ORIGIN = 'http://localhost:4174'

function cors(req, res) {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? PREVIEW_ORIGIN)
  res.setHeader('access-control-allow-credentials', 'true')
  res.setHeader(
    'access-control-allow-headers',
    'content-type, x-tenant-id, accept-language, idempotency-key, authorization, x-request-id',
  )
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
}

function json(req, res, status, body) {
  cors(req, res)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

let seq = 0

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const cookies = parseCookies(req)
  requestLog.push({ method: req.method, path: req.url })

  if (req.method === 'OPTIONS') {
    cors(req, res)
    res.writeHead(204)
    res.end()
    return
  }

  if (path === '/__health') {
    res.writeHead(200)
    res.end('ok')
    return
  }

  if (path === '/__privacy/log') {
    json(req, res, 200, requestLog)
    return
  }

  // Test hook: the download token a subject would have received by email.
  if (path.startsWith('/__privacy/download-token/')) {
    const id = path.split('/').pop() ?? ''
    for (const subject of subjects.values()) {
      const record = subject.dsrs.get(id)
      if (record) {
        json(req, res, 200, { token: record.export_token })
        return
      }
    }
    json(req, res, 404, { status: 404 })
    return
  }

  if (path === '/__privacy/log/clear') {
    requestLog.length = 0
    res.writeHead(204)
    res.end()
    return
  }

  if (path === '/api/v1/public/tenant-context') {
    const tenant = req.headers.host ? TENANTS[req.headers.host] : undefined
    if (!tenant) {
      json(req, res, 404, {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Unknown host',
      })
      return
    }
    json(req, res, 200, tenant)
    return
  }

  if (path === '/__theme/reset') {
    const host = (req.headers.host || '').split(':')[0]
    if (host && themes.has(host)) {
      themes.delete(host)
    } else {
      themes.clear()
    }
    json(req, res, 200, { status: 'ok' })
    return
  }

  if (path === '/api/v1/public/theme') {
    const state = getThemeState(req)
    json(req, res, 200, state.currentTheme)
    return
  }

  if (path === '/api/v1/tenant/theme/draft') {
    const state = getThemeState(req)
    if (req.method === 'GET') {
      json(req, res, 200, state.currentDraft)
      return
    }
    if (req.method === 'PUT') {
      const body = await readBody(req)
      if (body.theme_key) state.currentDraft.theme.theme_key = body.theme_key
      if (body.token_overrides) state.currentDraft.theme.token_overrides = body.token_overrides
      if (body.layout_overrides) state.currentDraft.theme.layout_overrides = body.layout_overrides
      if (body.custom_css !== undefined) state.currentDraft.theme.custom_css = body.custom_css
      state.currentDraft.theme.updated_at = new Date().toISOString()
      state.currentDraft.theme.state = 'draft'
      json(req, res, 200, state.currentDraft.theme)
      return
    }
  }

  if (path === '/api/v1/tenant/theme/preview') {
    const state = getThemeState(req)
    const token = url.searchParams.get('token')
    if (!token || token === 'invalid') {
      json(req, res, 403, {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Invalid or expired preview token',
      })
      return
    }
    const brandColor =
      state.currentDraft.theme.token_overrides?.['color.brand.primary']?.$value ??
      state.currentTheme.tokens['color.brand.primary']?.$value ??
      '#0066cc'
    const previewTheme = {
      ...state.currentTheme,
      tokens: {
        ...state.currentTheme.tokens,
        ...state.currentDraft.theme.token_overrides,
      },
      css_vars: `:root { --sanvi-color-brand-primary: ${brandColor}; }`,
      theme_key: state.currentDraft.theme.theme_key,
      revision: state.currentDraft.theme.revision,
      etag: '"etag-preview"',
    }
    json(req, res, 200, previewTheme)
    return
  }

  if (path === '/api/v1/tenant/theme/publish' && req.method === 'POST') {
    const state = getThemeState(req)
    state.previousTheme = { ...state.currentTheme, tokens: { ...state.currentTheme.tokens } }
    state.themeRevision += 1
    const brandColor =
      state.currentDraft.theme.token_overrides?.['color.brand.primary']?.$value ??
      state.currentTheme.tokens['color.brand.primary']?.$value ??
      '#0066cc'
    state.currentTheme = {
      ...state.currentTheme,
      tokens: {
        ...state.currentTheme.tokens,
        ...state.currentDraft.theme.token_overrides,
      },
      css_vars: `:root { --sanvi-color-brand-primary: ${brandColor}; }`,
      theme_key: state.currentDraft.theme.theme_key,
      revision: state.themeRevision,
      etag: `"etag-mock-${state.themeRevision}"`,
    }
    state.currentDraft.theme.state = 'live'
    state.currentDraft.theme.revision = state.themeRevision
    state.currentDraft.theme.updated_at = new Date().toISOString()
    json(req, res, 200, state.currentDraft.theme)
    return
  }

  if (path === '/api/v1/tenant/theme/rollback' && req.method === 'POST') {
    const state = getThemeState(req)
    if (!state.previousTheme) {
      json(req, res, 409, {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'No previous revision to rollback to',
      })
      return
    }
    state.themeRevision += 1
    state.currentTheme = {
      ...state.previousTheme,
      revision: state.themeRevision,
      etag: `"etag-mock-${state.themeRevision}"`,
    }
    state.previousTheme = null
    state.currentDraft.theme.state = 'live'
    state.currentDraft.theme.revision = state.themeRevision
    state.currentDraft.theme.token_overrides = { ...state.currentTheme.tokens }
    state.currentDraft.theme.updated_at = new Date().toISOString()
    json(req, res, 200, state.currentDraft.theme)
    return
  }

  if (path === '/api/v1/me' || path === '/api/v1/me/sessions') {
    // No session exists in the mock — `resolveSession` treats a 401 as
    // "signed out"; any other status would bubble up as a storefront 500.
    json(req, res, 401, { type: 'about:blank', title: 'Unauthorized', status: 401 })
    return
  }

  if (path === '/api/v1/privacy/directives') {
    json(req, res, 200, snapshotFor(cookies))
    return
  }

  if (path === '/api/v1/public/privacy/notice') {
    json(req, res, 200, NOTICE)
    return
  }

  if (path === '/api/v1/public/privacy/notice-at-collection') {
    json(req, res, 200, NOTICE_AT_COLLECTION)
    return
  }

  if (path === '/api/v1/public/subprocessors') {
    json(req, res, 200, SUBPROCESSORS)
    return
  }

  if (path === '/api/v1/public/privacy/metrics') {
    json(req, res, 200, METRICS)
    return
  }

  if (path === '/api/v1/privacy/consents' && req.method === 'PUT') {
    const body = await readBody(req)
    const subject = subjectFor(cookies)
    subject.overrides.set(body.purpose, {
      state: body.granted ? 'allowed' : 'denied',
      source: 'consent',
    })
    json(req, res, 200, {
      purpose: body.purpose,
      state: body.granted ? 'allowed' : 'denied',
      source: 'consent',
    })
    return
  }

  if (path === '/api/v1/privacy/opt-out' && req.method === 'POST') {
    const body = await readBody(req)
    const subject = subjectFor(cookies)
    for (const purpose of body.purposes ?? []) {
      subject.overrides.set(purpose, {
        state: 'denied',
        source: body.source === 'gpc' ? 'signal' : 'opt_out',
      })
    }
    const { code } = jurisdictionFor(cookies)
    json(req, res, 200, {
      jurisdiction: code,
      directives: (body.purposes ?? []).map((purpose) => ({
        purpose,
        state: 'denied',
        source: body.source === 'gpc' ? 'signal' : 'opt_out',
        effective_at: '2026-01-02T00:00:00Z',
        jurisdiction: code,
        notice_version: NOTICE_VERSION,
        superseded_at: null,
      })),
    })
    return
  }

  if (path === '/api/v1/privacy/limit-sensitive' && req.method === 'POST') {
    const subject = subjectFor(cookies)
    subject.overrides.set('sensitive_pi_use', { state: 'denied', source: 'opt_out' })
    json(req, res, 200, { jurisdiction: jurisdictionFor(cookies).code, directives: [] })
    return
  }

  if (path === '/api/v1/privacy/requests' && req.method === 'POST') {
    const body = await readBody(req)
    const subject = subjectFor(cookies)
    seq += 1
    const id = `req-${String(seq).padStart(4, '0')}`
    const anonymous = !body.subject?.evidence?.length && body.kind !== 'opt_out_sale_or_share'
    const verificationRequired = Boolean(body.subject?.email) && anonymous
    const received = new Date().toISOString()
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const record = {
      request_id: id,
      kind: body.kind,
      status: verificationRequired ? 'awaiting_verification' : 'in_progress',
      received_at: received,
      acknowledged_at: null,
      due_at: due,
      extended_to: null,
      completed_at: null,
      rejection_reason: null,
      jurisdiction: jurisdictionFor(cookies).code,
      export_available: false,
      export_token: null,
      appeal: null,
      challenge_id: verificationRequired ? `challenge-${id}` : null,
      download_count: 0,
    }
    subject.dsrs.set(id, record)
    json(req, res, 201, {
      request_id: id,
      status: record.status,
      due_at: due,
      jurisdiction: record.jurisdiction,
      verification_required: verificationRequired,
      challenge_id: record.challenge_id,
      effective_immediately: false,
      extended_to: null,
    })
    return
  }

  const dsrMatch = path.match(/^\/api\/v1\/privacy\/requests\/([^/]+)(\/.*)?$/)
  if (dsrMatch) {
    const subject = subjectFor(cookies)
    const record = subject.dsrs.get(dsrMatch[1])
    if (!record) {
      json(req, res, 404, { type: 'about:blank', title: 'Not Found', status: 404 })
      return
    }
    const action = dsrMatch[2] ?? ''

    if (action === '' && req.method === 'GET') {
      // A verifying request acknowledges itself once its token matches.
      if (record.status === 'awaiting_verification') {
        const token = url.searchParams.get('token')
        if (token && token === record.challenge_id) {
          record.status = 'in_progress'
          record.acknowledged_at = new Date().toISOString()
        }
      }
      if (record.status === 'in_progress' && record.kind === 'export' && !record.export_token) {
        record.export_token = `token-${record.request_id}`
        record.export_available = true
      }
      json(req, res, 200, {
        request_id: record.request_id,
        kind: record.kind,
        status: record.status,
        received_at: record.received_at,
        acknowledged_at: record.acknowledged_at,
        due_at: record.due_at,
        extended_to: record.extended_to,
        completed_at: record.completed_at,
        rejection_reason: record.rejection_reason,
        jurisdiction: record.jurisdiction,
        export_available: record.export_available,
        appeal: null,
        submitted_by: 'subject',
      })
      return
    }

    if (action === '/verify' && req.method === 'POST') {
      const body = await readBody(req)
      if (body.code !== '123456' || body.token !== record.challenge_id) {
        json(req, res, 404, { type: 'about:blank', title: 'Not Found', status: 404 })
        return
      }
      record.status = 'in_progress'
      record.acknowledged_at = new Date().toISOString()
      json(req, res, 200, {
        request_id: record.request_id,
        status: record.status,
        due_at: record.due_at,
      })
      return
    }

    if (action === '/download' && req.method === 'GET') {
      if (url.searchParams.get('token') !== record.export_token || !record.export_available) {
        json(req, res, 404, { type: 'about:blank', title: 'Not Found', status: 404 })
        return
      }
      record.download_count += 1
      if (record.download_count > 1) {
        json(req, res, 410, {
          type: 'about:blank',
          title: 'Gone',
          status: 410,
          detail: 'Expired or exhausted',
        })
        return
      }
      cors(req, res)
      res.writeHead(200, { 'content-type': 'application/octet-stream' })
      res.end('SANVI-EXPORT-BYTES')
      return
    }

    if (action === '/appeal' && req.method === 'POST') {
      record.status = 'under_appeal'
      seq += 1
      json(req, res, 201, {
        appeal_id: `appeal-${record.request_id}`,
        due_at: new Date(Date.now() + 45 * 86_400_000).toISOString(),
        authority: {
          name: 'California Privacy Protection Agency',
          complaint_url: 'https://cppa.ca.gov/complaints/',
        },
      })
      return
    }
  }

  json(req, res, 404, { type: 'about:blank', title: 'Not Found', status: 404 })
})

server.listen(PORT, () => {
  // biome-ignore lint/suspicious/noConsole: CI-visible confirmation that Playwright's first `webServer` entry actually came up.
  console.log(`[mock-api] listening on ${PORT}`)
})
