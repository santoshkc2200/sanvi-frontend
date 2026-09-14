import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../src/routes/advertising/Dashboard.svelte'
import { fixturePlatformByKey, platformViewFixture } from '@sanvi/ui/test-fixtures'

/**
 * Export hardening (phase 10, TASK-018): the metrics CSV download is
 * permission-gated, **streamed** rather than buffered for long ranges, and
 * its wire path stays free of blended-ROAS naming and raw customer data.
 *
 * The behavioural test stubs fetch with a genuine chunked ReadableStream so
 * the api-client → screen streaming path runs for real (jsdom has no File
 * System Access picker, so the chunked-fallback download is what runs — the
 * streaming *request* is identical, only where the bytes land afterwards).
 * The grep assertions hold the source to the same bar the e2e CSV-column
 * assertions check on the wire.
 */

const GOOGLE = fixturePlatformByKey('google_ads')!

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const HEALTH = {
  can_sync: true,
  can_upload_conversions: true,
  scopes_missing: [] as string[],
  reconnect_required: false,
  token_expires_at: null,
  last_error: null,
  last_synced_at: '2026-09-03T11:00:00Z',
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn_google_1',
    platform: GOOGLE.key,
    external_account_id: '123-456',
    account_name: 'Tokyo Retail',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: { ...HEALTH },
    ...overrides,
  }
}

function summaryRow(overrides: Record<string, unknown> = {}) {
  return {
    clicks: 100,
    conversion_value: { amount_minor: 120000, currency: 'JPY' },
    conversions: 12,
    currency: 'JPY',
    impressions: 10000,
    restating: false,
    roas_platform: 2,
    roas_sanvi: 1.5,
    sanvi_revenue: { amount_minor: 90000, currency: 'JPY' },
    spend: { amount_minor: 60000, currency: 'JPY' },
    ...overrides,
  }
}

function metricPoint(overrides: Record<string, unknown> = {}) {
  return {
    campaign_id: 'camp_1',
    clicks: 40,
    conversion_value: { amount_minor: 20000, currency: 'JPY' },
    conversions: 2,
    date: '2026-09-01',
    impressions: 3000,
    platform: GOOGLE.key,
    rendered_spend: null,
    restating: false,
    roas_platform: 2,
    roas_sanvi: 1.5,
    sanvi_revenue: { amount_minor: 15000, currency: 'JPY' },
    spend: { amount_minor: 10000, currency: 'JPY' },
    ...overrides,
  }
}

const CSV_HEADER =
  'date,campaign_id,platform,currency,impressions,clicks,conversions,conversion_value_minor,spend_minor,sanvi_revenue_minor,roas_platform,roas_sanvi,restating'

const CSV_CHUNKS = [
  `${CSV_HEADER}\ndate,camp_1,google_ads,JPY,1,1,1,2,1,1,2.0,1.0,`,
  'true\ndate,camp_1,google_ads,JPY,2,2,2,4,2,2,2.0,1.0,',
  'false\n',
]

/** A CSV body that arrives in three chunks, the way a long range would. */
function chunkedCsvResponse(): Response {
  const encoder = new TextEncoder()
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < CSV_CHUNKS.length) controller.enqueue(encoder.encode(CSV_CHUNKS[index]))
      else controller.close()
      index += 1
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/csv' },
  })
}

function setupFetch(handlers: {
  connections?: unknown[]
  metricsProblem?: { status: number }
  exportResponse?: Response
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/ads/metrics/summary')) return jsonResponse({ current: [summaryRow()] })
    if (url.includes('/ads/metrics/freshness')) return jsonResponse({})
    // The export branch must precede the bare-metrics one: the export URL
    // contains `/ads/metrics` too.
    if (url.includes('/ads/metrics/export')) {
      return handlers.exportResponse ?? chunkedCsvResponse()
    }
    if (url.includes('/ads/metrics')) return jsonResponse({ rows: [metricPoint()] })
    if (url.includes('/ads/platforms')) {
      return jsonResponse({
        platforms: [platformViewFixture(GOOGLE, { connection_state: 'connected' })],
      })
    }
    if (url.endsWith('/ads/connections')) {
      return jsonResponse({ connections: handlers.connections ?? [connection()] })
    }
    if (url.endsWith('/ads/campaigns')) return jsonResponse({ campaigns: [] })
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([{ feature: 'advertising.dashboard', enabled: true }])
  setLocale('en')
  setSession({
    userId: 'usr_1',
    email: 'owner@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [
      {
        tenant_id: 'dev-acme',
        tenant_slug: 'acme',
        tenant_name: 'Acme',
        role_id: 'owner',
        permissions: ['advertising.read', 'advertising.metrics.read'],
      },
    ],
    aal: 'aal2',
    methods: ['totp'],
    authenticatedAt: new Date().toISOString(),
    locale: 'en',
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setSession(null)
})

/** The export path's two source files, read once for the grep assertions.
    Vitest runs with the package directory as cwd. */
const dashboardSource = readFileSync('src/routes/advertising/Dashboard.svelte', 'utf8')
const apiClientSource = readFileSync('../../packages/api-client/src/advertising.ts', 'utf8')
/** The export-related slice of the api-client module: both export helpers
    and their contract docs, up to the next endpoint group. */
const exportApiSource = apiClientSource.slice(
  apiClientSource.lastIndexOf('/**', apiClientSource.indexOf('getAdMetricsExport')),
  apiClientSource.indexOf('getAdMetricsFreshness'),
)

describe('Advertising metrics export hardening (phase 10, TASK-018)', () => {
  it('assembles the streamed CSV in chunks and downloads the whole file', async () => {
    setupFetch({})
    const blobs: Blob[] = []
    const clicked: string[] = []
    // Subclass rather than clobber: the api-client builds every request
    // URL with `new URL`, which a plain object stub would break.
    class TestUrl extends URL {
      static override createObjectURL(blob: Blob): string {
        blobs.push(blob)
        return 'blob:export'
      }
      static override revokeObjectURL(): void {}
    }
    vi.stubGlobal('URL', TestUrl)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download)
    })

    render(Dashboard)
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))

    await waitFor(() => {
      expect(clicked).toHaveLength(1)
    })
    // Read the assembled file back: every chunk must have arrived, in
    // order, byte-exact — nothing dropped or garbled by the streaming
    // reader, no partial download.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blobs[0]!)
    })
    expect(text).toBe(CSV_CHUNKS.join(''))
    expect(clicked[0]).toMatch(/^sanvi-ads-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('hides the export control without advertising.metrics.read', async () => {
    setupFetch({})
    setSession({
      userId: 'usr_2',
      email: 'viewer@example.com',
      emailVerified: true,
      status: 'active',
      memberships: [
        {
          tenant_id: 'dev-acme',
          tenant_slug: 'acme',
          tenant_name: 'Acme',
          role_id: 'member',
          permissions: ['advertising.read'],
        },
      ],
      aal: 'aal2',
      methods: ['totp'],
      authenticatedAt: new Date().toISOString(),
      locale: 'en',
    })
    render(Dashboard)
    await screen.findAllByRole('heading', { name: /Spend/ })
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  })

  it('sources the export from the streaming client, not the buffered text call', () => {
    expect(dashboardSource).toContain('streamAdMetricsExport')
    expect(dashboardSource).not.toContain('getAdMetricsExport')
    // The download path consumes a stream — either piped to disk or read
    // chunk by chunk — never one buffered string.
    expect(dashboardSource).toMatch(/pipeTo\(|getReader\(/)
    expect(exportApiSource).toContain('ReadableStream')
  })

  it('keeps the permission gate in the export path', () => {
    expect(dashboardSource).toContain("can('advertising.metrics.read'")
    // The api-client contract documents the backend-side 403 the gate mirrors.
    expect(exportApiSource).toContain('advertising.metrics.read')
  })

  it('never names a blended ROAS in the export path', () => {
    // Word-bounded: `roas_platform` / `roasSanvi` are the two labelled
    // columns the contract ships; a bare `roas` — a column header, a
    // variable, an i18n key — is the blend that must not appear.
    expect(/\broas\b/.test(exportApiSource)).toBe(false)
    expect(/\broas\b/.test(dashboardSource)).toBe(false)
  })

  it('carries no raw customer data in the export path', () => {
    // The metrics export is aggregate ad performance only — platform,
    // campaign, and figures. Any customer-shaped identifier here would be
    // PII escaping through a report that never needed it.
    const banned =
      /\b(customer_email|customer_name|customer_phone|email_address|full_name|postal_code|street_address|phone_number)\b/
    expect(banned.test(exportApiSource)).toBe(false)
    expect(banned.test(dashboardSource)).toBe(false)
  })
})
