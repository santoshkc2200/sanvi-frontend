import { setLocale } from '@sanvi/i18n'
import { setSession } from '@sanvi/auth'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Creatives from '../src/routes/advertising/Creatives.svelte'
import {
  AD_PLATFORM_FIXTURES,
  fixturePlatformByKey,
  platformViewFixture,
} from '@sanvi/ui/test-fixtures'

/**
 * The creative library (TASK-013): the cross-platform list, the editor that
 * checks every selected placement's asset spec the moment an upload lands —
 * naming the placement and the failing dimension, offering to drop the
 * placement instead of the asset — and the per-placement create payloads.
 * The uploader is a fake `@sanvi/course-media` controller (the real one is
 * exercised in its own package); fetch is stubbed at the HTTP boundary.
 */

const META = fixturePlatformByKey('meta')!
const DEMO = fixturePlatformByKey('asymmetric_demo')!

// The fake uploader: `scenario` decides what the "measured" asset looks like.
let scenario: 'ok' | 'tooSmall' | 'portrait' = 'ok'
let uploadCount = 0

vi.mock('@sanvi/course-media', () => ({
  AssetUploadController: class {
    state = writable({ phase: 'idle' })
    start() {
      uploadCount += 1
      const n = uploadCount
      if (scenario === 'portrait') {
        // 9:16 — passes Meta's stories and reels specs at once, so a single
        // upload can be assigned to two placements.
        this.state.set({
          phase: 'ready',
          assetId: `asset_${n}`,
          localUrl: `blob:asset_${n}`,
          width: 1080,
          height: 1920,
          fileSizeBytes: 1_000_000,
          contentType: 'image/jpeg',
        })
        return
      }
      if (scenario === 'tooSmall') {
        this.state.set({
          phase: 'ready',
          assetId: `asset_${n}`,
          localUrl: `blob:asset_${n}`,
          width: 300,
          height: 300,
          fileSizeBytes: 500_000,
          contentType: 'image/jpeg',
        })
        return
      }
      this.state.set({
        phase: 'ready',
        assetId: `asset_${n}`,
        localUrl: `blob:asset_${n}`,
        width: 1080,
        height: 1080,
        fileSizeBytes: 1_000_000,
        contentType: 'image/jpeg',
      })
    }
    takeLocalUrl() {
      return 'blob:local'
    }
    reset() {
      this.state.set({ phase: 'idle' })
    }
    destroy() {}
  },
}))

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
    id: 'conn_meta_1',
    platform: META.key,
    external_account_id: '111-222',
    account_name: 'Acme Main',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    status: 'active',
    health: { ...HEALTH },
    ...overrides,
  }
}

function creativeView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cre_1',
    connection_id: 'conn_meta_1',
    platform: META.key,
    external_id: null,
    creative: {
      id: 'cre_1',
      placement: 'feed',
      texts: [
        { locale: 'en', headline: 'Summer sale', body: 'Up to 50% off' },
        { locale: 'ja', headline: '夏のセール', body: '最大50%オフ' },
      ],
      asset_references: ['asset_1'],
    },
    assets: [
      {
        aspect_ratio: '1:1',
        width_px: 1080,
        height_px: 1080,
        file_size_bytes: 1_000_000,
        duration_seconds: null,
        is_video: false,
      },
    ],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    ...overrides,
  }
}

function previewView(overrides: Record<string, unknown> = {}) {
  const feedPlacement = META.capability_matrix.creative_placements.find(
    (candidate) => candidate.key === 'feed',
  )!
  return {
    placement: 'feed',
    headline: 'Summer sale',
    body: 'Up to 50% off',
    asset_references: ['asset_1'],
    spec: feedPlacement.asset_spec,
    ...overrides,
  }
}

function catalogResponse(): Response {
  return jsonResponse({
    platforms: AD_PLATFORM_FIXTURES.map((fixture) =>
      platformViewFixture(fixture, { connection_state: 'connected' }),
    ),
  })
}

function setupFetch(
  options: { connections?: unknown[]; creatives?: unknown[]; previews?: unknown[] } = {},
): ReturnType<typeof vi.fn> {
  const connections = options.connections ?? [connection()]
  const creatives = options.creatives ?? []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/ads/platforms')) return catalogResponse()
    if (url.endsWith('/ads/connections')) return jsonResponse({ connections })
    if (url.includes('/previews')) {
      return jsonResponse({ previews: options.previews ?? [previewView()] })
    }
    if (url.endsWith('/ads/creatives')) {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { placement: string }
        return jsonResponse(
          creativeView({
            id: `cre_${body.placement}`,
            creative: {
              id: `cre_${body.placement}`,
              placement: body.placement,
              texts: [],
              asset_references: [],
            },
          }),
        )
      }
      return jsonResponse({ creatives })
    }
    if (/\/ads\/creatives\/[^/]+$/.test(url)) {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return jsonResponse(creatives[0] ?? {})
    }
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  scenario = 'ok'
  uploadCount = 0
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setEntitlements([])
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
        permissions: ['advertising.read', 'advertising.campaign.write'],
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

async function openEditor(): Promise<HTMLElement> {
  render(Creatives)
  fireEvent.click(await screen.findByRole('button', { name: 'New creative' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('Placements')
  return dialog
}

describe('AdvertisingCreatives list (phase 10, TASK-013)', () => {
  it('renders one cross-platform list with platform badges and per-locale copy meta', async () => {
    setupFetch({
      creatives: [
        creativeView(),
        creativeView({
          id: 'cre_2',
          connection_id: 'conn_meta_1',
          platform: 'google_ads',
          creative: {
            id: 'cre_2',
            placement: 'stories',
            texts: [{ locale: 'en', headline: 'Back to school', body: 'New term' }],
            asset_references: [],
          },
        }),
      ],
    })
    render(Creatives)

    expect(await screen.findByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('2 languages')).toBeInTheDocument()
    // Platform names come from the catalog as badges, per row.
    expect(screen.getByText(META.display_name)).toBeInTheDocument()
    expect(screen.getByText(/Google Ads/)).toBeInTheDocument()
    // Placement labels are the catalog's, not raw keys.
    expect(screen.getByText('Stories')).toBeInTheDocument()
  })

  it('shows the empty state when no creatives exist yet', async () => {
    setupFetch()
    render(Creatives)
    expect(await screen.findByText('No creatives yet')).toBeInTheDocument()
  })

  it('sorts by placement when the column header is clicked', async () => {
    setupFetch({
      creatives: [
        creativeView(),
        creativeView({
          id: 'cre_2',
          creative: {
            id: 'cre_2',
            placement: 'stories',
            texts: [{ locale: 'en', headline: 'B', body: '' }],
            asset_references: [],
          },
        }),
      ],
    })
    render(Creatives)
    await screen.findByText('Summer sale')

    fireEvent.click(screen.getByRole('button', { name: /Placement/ }))
    await waitFor(() => {
      const cells = screen.getAllByText(/^(Feed|Stories)$/)
      expect(cells[0]).toHaveTextContent('Feed')
    })
    fireEvent.click(screen.getByRole('button', { name: /Placement/ }))
    await waitFor(() => {
      const cells = screen.getAllByText(/^(Feed|Stories)$/)
      expect(cells[0]).toHaveTextContent('Stories')
    })
  })
})

describe('AdvertisingCreatives editor (phase 10, TASK-013)', () => {
  it('creates a creative for the selected placement with an idempotency key', async () => {
    const fetchMock = setupFetch()
    const dialog = await openEditor()

    // The single active connection is preselected; its matrix placements
    // render as checkboxes straight from the fixture matrix. One placement
    // is selected because the contract's creative grain is per placement —
    // and no single image passes Meta's feed (1:1) and stories (9:16)
    // specs at once, which is exactly what the spec checks enforce.
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Feed' }))

    // Copy per locale, driven by the matrix's text limits.
    const headlines = within(dialog).getAllByLabelText('Headline')
    fireEvent.input(headlines[0]!, { target: { value: 'Summer sale' } })

    // The editor demands at least one image before it lets the data ship:
    // upload through the course-media controller.
    fireEvent.change(within(dialog).getByLabelText('Upload image'), {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
    })
    await within(dialog).findByRole('button', { name: 'Remove image' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      const creates = fetchMock.mock.calls.filter(
        ([input, init]) => String(input).endsWith('/ads/creatives') && init?.method === 'POST',
      )
      expect(creates.length).toBe(1)
    })
    const [, init] = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/ads/creatives') && init?.method === 'POST',
    )!
    expect((init as RequestInit).headers).toHaveProperty('idempotency-key')
    const body = JSON.parse(String((init as RequestInit).body)) as {
      placement: string
      texts: { locale: string; headline: string }[]
      asset_references: string[]
    }
    expect(body.placement).toBe('feed')
    // Every field the locale's limits define is sent — the contract's text
    // struct has no optional fields.
    expect(body.texts[0]).toEqual({ locale: 'en', headline: 'Summer sale', body: '' })
    expect(body.asset_references).toEqual(['asset_1'])
  })

  it('rejects an asset for the placement it fails, at upload, naming both', async () => {
    scenario = 'tooSmall'
    setupFetch()
    const dialog = await openEditor()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Feed' }))
    fireEvent.change(within(dialog).getByLabelText('Upload image'), {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
    })

    // 300×300 fails the feed placement's 600×600 minimum: the message names
    // the placement and the failing dimension, with a resolution per issue.
    await within(dialog).findByText(/Feed: the image is 300 px wide/)
    await within(dialog).findByText(/Feed: the image is 300 px tall/)
    // One remove per surface (thumbnail + violation row), one drop for the
    // placement — exactly one placement fails, so exactly one drop button.
    expect(within(dialog).getAllByRole('button', { name: 'Remove image' }).length).toBeGreaterThan(
      0,
    )
    expect(within(dialog).getByRole('button', { name: 'Drop Feed' })).toBeInTheDocument()

    // Save stays blocked while any placement is failing.
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('dropping the placement clears its violation instead of discarding the asset', async () => {
    scenario = 'tooSmall'
    setupFetch()
    const dialog = await openEditor()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Feed' }))
    fireEvent.change(within(dialog).getByLabelText('Upload image'), {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
    })
    await within(dialog).findByText(/Feed: the image is 300 px wide/)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Drop Feed' }))
    await waitFor(() => {
      expect(within(dialog).queryByText(/Feed: the image is 300 px wide/)).toBeNull()
    })
    // The asset itself stays — the placement went, not the image.
    expect(within(dialog).getAllByRole('button', { name: 'Remove image' }).length).toBeGreaterThan(
      0,
    )
  })

  it('renders the third network matrix with no code change', async () => {
    setupFetch({
      connections: [connection({ id: 'conn_demo_1', platform: DEMO.key, currency: 'JPY' })],
    })
    const dialog = await openEditor()

    // The asymmetric network has exactly one placement and no video — both
    // facts arrive as matrix data; nothing in the screen knows the network.
    expect(within(dialog).getByRole('checkbox', { name: 'Feed' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox', { name: 'Stories' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Feed' }))
    expect(await within(dialog).findByText('No video')).toBeInTheDocument()
    expect(within(dialog).getByText('At least one image')).toBeInTheDocument()
    expect(within(dialog).getByText('Aspect ratio 1:1')).toBeInTheDocument()
  })

  it('shows the server verbatim violations when the platform still refuses', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/ads/creatives') && init?.method === 'POST') {
        return jsonResponse(
          {
            type: 'about:blank',
            title: 'Bad request',
            status: 400,
            violations: [
              {
                field_path: 'texts[0].headline',
                code: 'too_long',
                message: 'headline exceeds the 25-character ja limit',
              },
            ],
          },
          400,
        )
      }
      if (url.includes('/ads/platforms')) return catalogResponse()
      if (url.endsWith('/ads/connections')) return jsonResponse({ connections: [connection()] })
      if (url.endsWith('/ads/creatives')) return jsonResponse({ creatives: [] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const dialog = await openEditor()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Feed' }))
    fireEvent.input(within(dialog).getAllByLabelText('Headline')[0]!, {
      target: { value: 'Summer' },
    })
    fireEvent.change(within(dialog).getByLabelText('Upload image'), {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
    })
    await within(dialog).findByRole('button', { name: 'Remove image' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await screen.findByText(/rejected some details/)).toBeInTheDocument()
    expect(screen.getByText(/headline exceeds the 25-character ja limit/)).toBeInTheDocument()
  })

  it('keeps the editor open and says so when only some placements were created', async () => {
    // One create of the two fails. Closing the dialog with a success toast
    // here would tell the user everything shipped while a placement is
    // missing — the half that succeeded must not be re-sent on retry either.
    scenario = 'portrait'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/ads/creatives') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { placement: string }
        if (body.placement === 'reels') {
          return jsonResponse(
            {
              type: 'about:blank',
              title: 'Bad request',
              status: 400,
              violations: [
                { field_path: 'placement', code: 'unsupported', message: 'reels is closed' },
              ],
            },
            400,
          )
        }
        return jsonResponse(creativeView({ id: `cre_${body.placement}` }))
      }
      if (url.includes('/ads/platforms')) return catalogResponse()
      if (url.endsWith('/ads/connections')) return jsonResponse({ connections: [connection()] })
      if (url.endsWith('/ads/creatives')) return jsonResponse({ creatives: [] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const dialog = await openEditor()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Stories' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Reels' }))
    fireEvent.input(within(dialog).getAllByLabelText('Headline')[0]!, {
      target: { value: 'Summer' },
    })
    fireEvent.change(within(dialog).getByLabelText('Upload image'), {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
    })
    await within(dialog).findByRole('button', { name: 'Remove image' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await within(dialog).findByText(/reels is closed/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Creative created')).toBeNull()
    // Stories shipped, so it is deselected; reels stays selected to retry.
    await waitFor(() => {
      expect(within(dialog).getByRole('checkbox', { name: 'Stories' })).not.toBeChecked()
    })
    expect(within(dialog).getByRole('checkbox', { name: 'Reels' })).toBeChecked()
  })

  it('has no axe violations in the editor', async () => {
    setupFetch()
    const dialog = await openEditor()
    expect(await axe(dialog)).toHaveNoViolations()
  })
})

describe('AdvertisingCreatives previews and delete (phase 10, TASK-013)', () => {
  it('renders the server-computed placement previews for a saved creative', async () => {
    setupFetch({ creatives: [creativeView()] })
    render(Creatives)
    await screen.findByText('Summer sale')

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Summer sale')
    expect(within(dialog).getAllByText('Feed').length).toBeGreaterThan(0)
  })

  it('deletes after confirmation and reloads the list', async () => {
    const fetchMock = setupFetch({ creatives: [creativeView()] })
    render(Creatives)
    await screen.findByText('Summer sale')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      const deletes = fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).includes('/ads/creatives/cre_1') && init?.method === 'DELETE',
      )
      expect(deletes.length).toBe(1)
    })
  })

  it('explains an in-use creative instead of surfacing a raw error', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/ads/creatives/cre_1') && init?.method === 'DELETE') {
        return jsonResponse({ type: 'about:blank', title: 'Conflict', status: 409 }, 409)
      }
      if (url.includes('/ads/platforms')) return catalogResponse()
      if (url.endsWith('/ads/connections')) return jsonResponse({ connections: [connection()] })
      if (url.endsWith('/ads/creatives')) return jsonResponse({ creatives: [creativeView()] })
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(Creatives)
    await screen.findByText('Summer sale')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await within(dialog).findByText(/attached to an ad/)).toBeInTheDocument()
  })

  it('has no axe violations in the list', async () => {
    setupFetch({ creatives: [creativeView()] })
    const { container } = render(Creatives)
    await screen.findByText('Summer sale')
    expect(await axe(container)).toHaveNoViolations()
  })
})
