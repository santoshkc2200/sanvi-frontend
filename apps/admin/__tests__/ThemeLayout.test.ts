import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeLayout from '../src/routes/ThemeLayout.svelte'

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
    layouts: {
      'storefront.home': {
        locked: false,
        slots: ['hero', 'feature-grid', 'cta', 'footer'],
      },
      'storefront.checkout': {
        locked: true,
        slots: ['summary', 'payment'],
      },
    },
    overridable: [],
  },
  theme: {
    revision: 1,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {},
    token_overrides: {},
    layout_overrides: {
      'storefront.home': {
        hidden_slots: ['cta'],
      },
    },
    updated_at: '2026-08-29T12:00:00Z',
  },
}

describe('Theme Layout Route Component', () => {
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

  it('renders page layout slots and slot visibility toggles', async () => {
    render(ThemeLayout)
    expect(await screen.findByText('hero')).toBeInTheDocument()
    expect(screen.getByText('feature-grid')).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemeLayout)
    await screen.findByText('hero')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
