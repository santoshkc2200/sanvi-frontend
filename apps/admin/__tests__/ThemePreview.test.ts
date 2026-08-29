import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemePreview from '../src/routes/ThemePreview.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_DRAFT = {
  spec: {
    key: 'dawn',
    version: '1.0.0',
    capabilities: ['tokens', 'layouts'],
    fonts: [],
    layouts: {},
    overridable: [],
  },
  theme: {
    revision: 2,
    state: 'draft',
    theme_key: 'dawn',
    version: '1.0.0',
    assets: {},
    token_overrides: {
      'color.brand.primary': { $value: '#0066cc', $type: 'color' },
    },
    layout_overrides: {},
    updated_at: '2026-08-29T12:30:00Z',
  },
}

describe('Theme Preview Route Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/theme/draft')) {
          return Promise.resolve(jsonResponse(MOCK_DRAFT))
        }
        return Promise.resolve(jsonResponse({}, 404))
      }),
    )

    setMemberships([
      {
        tenantId: '0190f0d0-0000-7000-8000-000000000001',
        slug: 'test-tenant',
        displayName: 'Test Tenant',
        role: 'owner',
      },
    ])
    switchTenant('0190f0d0-0000-7000-8000-000000000001')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders preview title, controls, and device frames', async () => {
    render(ThemePreview)

    expect(await screen.findByRole('heading', { name: 'Live Preview' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Desktop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Side by Side' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
  })

  it('renders iframes with correct preview URL and parameters', async () => {
    render(ThemePreview)

    const desktopIframe = (await screen.findByTitle('Desktop frame')) as HTMLIFrameElement
    expect(desktopIframe).toBeInTheDocument()
    expect(desktopIframe.src).toContain('/_theme-preview')
    expect(desktopIframe.src).toContain('locale=en')
    expect(desktopIframe.src).toContain('mode=light')
  })

  it('switches device mode and light/dark theme mode', async () => {
    render(ThemePreview)

    const darkButton = await screen.findByRole('button', { name: 'Dark' })
    await fireEvent.click(darkButton)

    const desktopIframe = screen.getByTitle('Desktop frame') as HTMLIFrameElement
    expect(desktopIframe.src).toContain('mode=dark')

    const mobileOnlyButton = screen.getByRole('button', { name: 'Mobile' })
    await fireEvent.click(mobileOnlyButton)

    expect(screen.queryByTitle('Desktop frame')).not.toBeInTheDocument()
    expect(screen.getByTitle('Mobile frame')).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemePreview)
    await screen.findByRole('heading', { name: 'Live Preview' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
