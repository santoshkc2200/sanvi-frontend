import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeTypography from '../src/routes/ThemeTypography.svelte'

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
    fonts: [
      {
        family: 'Inter',
        source: 'local',
        subsets: ['latin'],
      },
      {
        family: 'Noto Sans JP',
        source: 'local',
        subsets: ['latin', 'ja', 'japanese'],
      },
      {
        family: 'Merriweather',
        source: 'local',
        subsets: ['latin'],
      },
    ],
    layouts: {},
    overridable: ['font.family.base', 'font.family.heading'],
  },
  theme: {
    revision: 1,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {},
    token_overrides: {
      'font.family.base': { $value: 'Inter', $type: 'fontFamily' },
      'font.family.heading': { $value: 'Inter', $type: 'fontFamily' },
    },
    layout_overrides: {},
    updated_at: '2026-08-29T12:00:00Z',
  },
}

describe('Theme Typography Route Component', () => {
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

  it('renders curated font selectors', async () => {
    render(ThemeTypography)
    expect(await screen.findByText('Body Font')).toBeInTheDocument()
    expect(screen.getByText('Heading Font')).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemeTypography)
    await screen.findByText('Body Font')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
