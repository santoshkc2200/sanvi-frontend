import { setEntitlements, setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeGallery from '../src/routes/ThemeGallery.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_THEMES = {
  themes: [
    {
      key: 'base',
      name: { en: 'Base Theme', ja: 'ベーステーマ' },
      version: '1.0.0',
      status: 'active',
      visibility: 'public',
      dark_mode: true,
      capabilities: ['layouts', 'tokens'],
    },
    {
      key: 'aurora',
      name: { en: 'Aurora Theme', ja: 'オーロラテーマ' },
      version: '1.2.0',
      status: 'active',
      visibility: 'premium',
      required_feature: 'theming.premium',
      dark_mode: true,
      capabilities: ['layouts', 'tokens', 'custom_css'],
    },
    {
      key: 'minimal',
      name: { en: 'Minimal Theme', ja: 'ミニマルテーマ' },
      version: '0.9.0',
      status: 'active',
      visibility: 'public',
      dark_mode: false,
      capabilities: ['tokens'],
    },
  ],
}

const MOCK_DRAFT = {
  spec: {
    key: 'base',
    version: '1.0.0',
    capabilities: ['layouts', 'tokens'],
    fonts: [],
    layouts: {},
    overridable: ['color.brand.primary'],
  },
  theme: {
    revision: 1,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {},
    token_overrides: {},
    layout_overrides: {},
    updated_at: '2026-08-29T12:00:00Z',
  },
}

function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url.includes('/tenant/themes/available')) {
    return Promise.resolve(jsonResponse(MOCK_THEMES))
  }
  if (url.includes('/tenant/theme/draft')) {
    return Promise.resolve(jsonResponse(MOCK_DRAFT))
  }
  return Promise.resolve(jsonResponse({}, 404))
}

describe('Admin Theme Gallery Route Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(mockFetch))
    setMemberships([
      {
        tenantId: '0190f0d0-0000-7000-8000-000000000001',
        slug: 'test-tenant',
        displayName: 'Test Tenant',
        role: 'owner',
      },
    ])
    switchTenant('0190f0d0-0000-7000-8000-000000000001')
    setEntitlements([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders available themes and marks the tenant current theme', async () => {
    render(ThemeGallery)

    expect(await screen.findByText('Base Theme')).toBeInTheDocument()
    expect(screen.getByText('Minimal Theme')).toBeInTheDocument()

    // Current theme should have the badge / indicator
    const currentBadges = screen.getAllByText('Current Theme')
    expect(currentBadges.length).toBeGreaterThan(0)
  })

  it('hides themes whose required_feature is not entitled', async () => {
    // With no entitlements, aurora (requiring theming.premium) must be hidden
    render(ThemeGallery)

    await screen.findByText('Base Theme')
    expect(screen.queryByText('Aurora Theme')).not.toBeInTheDocument()
  })

  it('shows premium theme when required_feature is entitled', async () => {
    setEntitlements([{ feature: 'theming.premium', enabled: true }])
    render(ThemeGallery)

    expect(await screen.findByText('Aurora Theme')).toBeInTheDocument()
  })

  it('handles error state when listAvailableThemes fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/themes/available')) {
          return Promise.resolve(jsonResponse({ title: 'Bad Request', status: 400 }, 400))
        }
        return Promise.resolve(jsonResponse(MOCK_DRAFT))
      }),
    )

    render(ThemeGallery)
    expect(await screen.findByText(/Could not load themes/i)).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemeGallery)
    await screen.findByText('Base Theme')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
