import { ApiError } from '@sanvi/api-client'
import { setLocale } from '@sanvi/i18n'
import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdvertisingSettings from '../src/routes/AdvertisingSettings.svelte'

vi.mock('@sanvi/api-client', async () => {
  const actual = await vi.importActual<typeof import('@sanvi/api-client')>('@sanvi/api-client')
  return {
    ...actual,
    listAdPlatforms: vi.fn(),
  }
})

const EMPTY_CATALOG = { platforms: [] }

beforeEach(async () => {
  setMemberships([{ tenantId: 'dev-acme', slug: 'acme', displayName: 'Acme', role: 'owner' }])
  switchTenant('dev-acme')
  setLocale('en')

  const { listAdPlatforms } = await import('@sanvi/api-client')
  vi.mocked(listAdPlatforms).mockResolvedValue(EMPTY_CATALOG)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AdvertisingSettings shell (phase 10, TASK-009)', () => {
  it('renders the empty state when the tenant holds an advertising entitlement', async () => {
    setEntitlements([{ feature: 'advertising.google_ads', enabled: true }])
    render(AdvertisingSettings)

    expect(
      await screen.findByText("Advertising connections aren't available yet."),
    ).toBeInTheDocument()
    const { listAdPlatforms } = await import('@sanvi/api-client')
    expect(listAdPlatforms).toHaveBeenCalledTimes(1)
  })

  it('renders the UpgradePrompt without any advertising entitlement and never calls the API', async () => {
    setEntitlements([])
    render(AdvertisingSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Running ad campaigns needs a plan that includes advertising. Ask a tenant owner to upgrade.',
      ),
    ).toBeInTheDocument()
    const { listAdPlatforms } = await import('@sanvi/api-client')
    expect(listAdPlatforms).not.toHaveBeenCalled()
  })

  it('falls back to the UpgradePrompt when the API denies the catalog (403)', async () => {
    setEntitlements([{ feature: 'advertising.meta_ads', enabled: true }])
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(
      new ApiError(403, { type: 'about:blank', title: 'Forbidden', status: 403 }, undefined),
    )
    render(AdvertisingSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    expect(
      screen.queryByText("Advertising connections aren't available yet."),
    ).not.toBeInTheDocument()
  })

  it('falls back to the UpgradePrompt when the advertising flag is off and the route is absent (404)', async () => {
    setEntitlements([{ feature: 'advertising.google_ads', enabled: true }])
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(
      new ApiError(404, { type: 'about:blank', title: 'Not found', status: 404 }, undefined),
    )
    render(AdvertisingSettings)

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
  })

  it('renders a retryable error on unexpected failures', async () => {
    setEntitlements([{ feature: 'advertising.google_ads', enabled: true }])
    const { listAdPlatforms } = await import('@sanvi/api-client')
    vi.mocked(listAdPlatforms).mockRejectedValue(new Error('network gone'))
    render(AdvertisingSettings)

    expect(
      await screen.findByText('Could not load advertising platforms. Try again in a moment.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('renders Japanese copy when the locale is ja', async () => {
    setEntitlements([{ feature: 'advertising.google_ads', enabled: true }])
    setLocale('ja')
    render(AdvertisingSettings)

    expect(await screen.findByText('広告の接続はまだ利用できません。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '広告' })).toBeInTheDocument()
  })

  it.each([{ entitled: true }, { entitled: false }])(
    'loads no external (ad-platform) script on the empty-state path (entitled: $entitled)',
    async ({ entitled }) => {
      setEntitlements(entitled ? [{ feature: 'advertising.google_ads', enabled: true }] : [])
      const { container } = render(AdvertisingSettings)
      await screen.findByText(
        entitled ? "Advertising connections aren't available yet." : 'Upgrade required',
      )

      const externalScripts = Array.from(container.querySelectorAll('script[src]'))
      expect(externalScripts).toEqual([])
      expect(container.outerHTML).not.toMatch(/googleusercontent|fbcdn|accounts\.google\.com/)
    },
  )

  it('passes axe on both render paths', async () => {
    setEntitlements([{ feature: 'advertising.google_ads', enabled: true }])
    const entitledView = render(AdvertisingSettings)
    await screen.findByText("Advertising connections aren't available yet.")
    expect(await axe(entitledView.container)).toHaveNoViolations()
    entitledView.unmount()

    setEntitlements([])
    const deniedView = render(AdvertisingSettings)
    await screen.findByText('Upgrade required')
    expect(await axe(deniedView.container)).toHaveNoViolations()
  })
})
