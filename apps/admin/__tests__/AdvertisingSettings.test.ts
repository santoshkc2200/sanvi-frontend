import { ApiError } from '@sanvi/api-client'
import type { PlatformsView } from '@sanvi/api-client'
import { setLocale } from '@sanvi/i18n'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen, within } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdvertisingSettings from '../src/routes/AdvertisingSettings.svelte'
import {
  AD_PLATFORM_FIXTURES,
  fixturePlatformByKey,
  platformViewFixture,
} from '@sanvi/ui/test-fixtures'

vi.mock('@sanvi/api-client', async () => {
  const actual = await vi.importActual<typeof import('@sanvi/api-client')>('@sanvi/api-client')
  return {
    ...actual,
    listAdPlatforms: vi.fn(),
  }
})

const EMPTY_CATALOG: PlatformsView = { platforms: [] }

const GOOGLE = fixturePlatformByKey('google_ads')!
const META = fixturePlatformByKey('meta')!

/** Catalog with one entitled and one upgrade-required platform (fixture data). */
function mixedCatalog(): PlatformsView {
  return {
    platforms: [
      platformViewFixture(GOOGLE, { connection_state: 'connected' }),
      platformViewFixture(META, { upgrade_required: true }),
    ] as PlatformsView['platforms'],
  }
}

beforeEach(async () => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setLocale('en')
  setEntitlements([])

  const { listAdPlatforms } = await import('@sanvi/api-client')
  vi.mocked(listAdPlatforms).mockResolvedValue(EMPTY_CATALOG)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdvertisingSettings platform catalog (phase 10, TASK-010)', () => {
  it('renders one card per catalog platform with its entitlement state', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue(mixedCatalog())
    render(AdvertisingSettings)

    expect(await screen.findByRole('heading', { name: GOOGLE.display_name })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: META.display_name })).toBeInTheDocument()

    // Entitled platform: connect CTA (inert until TASK-011) with its reason.
    const googleCard = screen
      .getByRole('heading', { name: GOOGLE.display_name })
      .closest('article') as HTMLElement
    expect(within(googleCard).getByText('Connected')).toBeInTheDocument()
    expect(within(googleCard).getByRole('button', { name: 'Connect' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(
      within(googleCard).getByText(
        'Connection setup arrives in an upcoming update. Campaigns you already run on the platform keep running.',
      ),
    ).toBeInTheDocument()

    // Non-entitled platform stays listed, with its upgrade path.
    const metaCard = screen
      .getByRole('heading', { name: META.display_name })
      .closest('article') as HTMLElement
    expect(within(metaCard).getByText('Upgrade required')).toBeInTheDocument()
    expect(
      within(metaCard).getByText(
        'Advertising on Meta Ads needs a plan that includes it. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
  })

  it('renders capability labels from the catalogs, keyed by matrix value', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue(mixedCatalog())
    render(AdvertisingSettings)

    const googleCard = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(googleCard).getByText('What connecting allows')).toBeInTheDocument()
    // Objectives render as one summary line, labels resolved by matrix value.
    expect(
      within(googleCard).getByText('App promotion, Awareness, Leads, Sales, Traffic'),
    ).toBeInTheDocument()
    expect(within(googleCard).getByText('Feed, Stories')).toBeInTheDocument()
  })

  it('renders a value with no i18n key humanized, not raw', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    const customPlatform = {
      ...GOOGLE,
      capability_matrix: {
        ...GOOGLE.capability_matrix,
        objectives: ['untranslated_goal'],
      },
    }
    vi.mocked(listAdPlatforms).mockResolvedValue({
      platforms: [platformViewFixture(customPlatform)],
    } as PlatformsView)
    render(AdvertisingSettings)

    const card = (await screen.findByRole('heading', { name: GOOGLE.display_name })).closest(
      'article',
    ) as HTMLElement
    expect(within(card).getByText('Untranslated Goal')).toBeInTheDocument()
    expect(within(card).queryByText('untranslated_goal')).not.toBeInTheDocument()
  })

  it('renders the empty state when the catalog is empty', async () => {
    render(AdvertisingSettings)
    expect(
      await screen.findByText("Advertising connections aren't available yet."),
    ).toBeInTheDocument()
  })

  it('falls back to the page UpgradePrompt when the catalog is denied (403)', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(
      new ApiError(403, { type: 'about:blank', title: 'Forbidden', status: 403 }, undefined),
    )
    render(AdvertisingSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Running ad campaigns needs a plan that includes advertising. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Advertising connections aren't available yet."),
    ).not.toBeInTheDocument()
  })

  it('falls back to the empty state when the advertising flag is off and the route is absent (404)', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(
      new ApiError(404, { type: 'about:blank', title: 'Not found', status: 404 }, undefined),
    )
    render(AdvertisingSettings)

    // A missing route means the feature is not deployed, not that the tenant is
    // on too small a plan — an upgrade prompt would misdescribe it.
    expect(
      await screen.findByText("Advertising connections aren't available yet."),
    ).toBeInTheDocument()
    expect(screen.queryByText('Upgrade required')).not.toBeInTheDocument()
  })

  it('renders a retryable error on unexpected failures', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(new Error('network gone'))
    render(AdvertisingSettings)

    expect(
      await screen.findByText('Could not load advertising platforms. Try again in a moment.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('renders Japanese copy and localized matrix values when the locale is ja', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue(mixedCatalog())
    setLocale('ja')
    render(AdvertisingSettings)

    expect(await screen.findByRole('heading', { name: '広告' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '広告プラットフォーム' })).toBeInTheDocument()
    const googleCard = screen
      .getByRole('heading', { name: GOOGLE.display_name })
      .closest('article') as HTMLElement
    expect(within(googleCard).getByText('接続済み')).toBeInTheDocument()
    expect(
      within(googleCard).getByText('アプリの宣伝, 認知度の向上, リード, 売上, トラフィック'),
    ).toBeInTheDocument()
  })

  it('loads no external (ad-platform) script on any render path', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue(mixedCatalog())
    const { container, unmount } = render(AdvertisingSettings)
    await screen.findByRole('heading', { name: GOOGLE.display_name })
    expect(Array.from(container.querySelectorAll('script[src]'))).toEqual([])
    expect(container.outerHTML).not.toMatch(/googleusercontent|fbcdn|accounts\.google\.com/)
    unmount()

    const deniedView = render(AdvertisingSettings)
    await screen.findByText('Upgrade required')
    expect(Array.from(deniedView.container.querySelectorAll('script[src]'))).toEqual([])
  })

  it('passes axe on the catalog, empty, and upgrade paths', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue(mixedCatalog())
    const catalogView = render(AdvertisingSettings)
    await screen.findByRole('heading', { name: GOOGLE.display_name })
    expect(await axe(catalogView.container)).toHaveNoViolations()
    catalogView.unmount()

    vi.mocked(listAdPlatforms).mockResolvedValue(EMPTY_CATALOG)
    const emptyView = render(AdvertisingSettings)
    await screen.findByText("Advertising connections aren't available yet.")
    expect(await axe(emptyView.container)).toHaveNoViolations()
    emptyView.unmount()

    vi.mocked(listAdPlatforms).mockRejectedValue(
      new ApiError(403, { type: 'about:blank', title: 'Forbidden', status: 403 }, undefined),
    )
    const deniedView = render(AdvertisingSettings)
    await screen.findByText('Upgrade required')
    expect(await axe(deniedView.container)).toHaveNoViolations()
  })

  it('lists every fixture platform without per-platform code (catalog is the only source)', async () => {
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockResolvedValue({
      platforms: AD_PLATFORM_FIXTURES.map((fixture) => platformViewFixture(fixture)),
    } as PlatformsView)
    render(AdvertisingSettings)

    for (const fixture of AD_PLATFORM_FIXTURES) {
      expect(await screen.findByRole('heading', { name: fixture.display_name })).toBeInTheDocument()
    }
  })
})
