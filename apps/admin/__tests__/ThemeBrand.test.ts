import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeBrand from '../src/routes/ThemeBrand.svelte'

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
    overridable: [],
  },
  theme: {
    revision: 1,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {
      logo: {
        digest: 'sha256-1111',
        ext: 'png',
        kind: 'logo',
        mime: 'image/png',
        uploaded_at: '2026-08-29T12:00:00Z',
      },
    },
    token_overrides: {},
    layout_overrides: {},
    updated_at: '2026-08-29T12:00:00Z',
  },
}

describe('Theme Brand Route Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/theme/draft')) {
          return Promise.resolve(jsonResponse(MOCK_DRAFT))
        }
        if (url.includes('/tenant/theme/assets')) {
          return Promise.resolve(
            jsonResponse({
              ...MOCK_DRAFT.theme,
              assets: {
                ...MOCK_DRAFT.theme.assets,
                favicon: {
                  digest: 'sha256-2222',
                  ext: 'png',
                  kind: 'favicon',
                  mime: 'image/png',
                  uploaded_at: '2026-08-29T12:05:00Z',
                },
              },
            }),
          )
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

  it('renders brand asset sections and current assets', async () => {
    render(ThemeBrand)
    expect(await screen.findByRole('heading', { name: 'Logo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Favicon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Social Sharing Image (OG)' })).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemeBrand)
    await screen.findByRole('heading', { name: 'Logo' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
