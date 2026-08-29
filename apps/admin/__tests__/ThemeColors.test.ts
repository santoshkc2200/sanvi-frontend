import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeColors from '../src/routes/ThemeColors.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MOCK_DRAFT = {
  spec: {
    key: 'base',
    version: '1.0.0',
    capabilities: ['tokens', 'layouts'],
    fonts: [],
    layouts: {},
    overridable: [
      'color.brand.primary',
      'color.brand.hover',
      'color.brand.contrast',
      'color.text.primary',
      'color.text.secondary',
      'color.text.inverse',
      'color.background.primary',
      'color.background.inverse',
      'color.focus.ring',
    ],
  },
  theme: {
    revision: 1,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {},
    token_overrides: {
      'color.brand.primary': { $value: '#2563eb', $type: 'color' },
      'color.brand.hover': { $value: '#1d4ed8', $type: 'color' },
      'color.brand.contrast': { $value: '#ffffff', $type: 'color' },
      'color.text.primary': { $value: '#1a1d23', $type: 'color' },
      'color.text.secondary': { $value: '#4a505c', $type: 'color' },
      'color.text.inverse': { $value: '#ffffff', $type: 'color' },
      'color.background.primary': { $value: '#ffffff', $type: 'color' },
      'color.background.inverse': { $value: '#1a1d23', $type: 'color' },
      'color.focus.ring': { $value: '#1d4ed8', $type: 'color' },
    },
    layout_overrides: {},
    updated_at: '2026-08-29T12:00:00Z',
  },
}

describe('Theme Colors Route Component', () => {
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

  it('renders color token controls and checks contrast in real time', async () => {
    render(ThemeColors)
    expect(await screen.findByText(/meets WCAG requirements/i)).toBeInTheDocument()
    expect(screen.getByText('Brand Primary')).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemeColors)
    await screen.findByText(/meets WCAG requirements/i)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
