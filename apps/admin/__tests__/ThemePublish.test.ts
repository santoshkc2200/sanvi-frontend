import { setMemberships, switchTenant } from '@sanvi/tenant'
import { axe } from '@sanvi/test-config/axe'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemePublish from '../src/routes/ThemePublish.svelte'

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
    revision: 2,
    state: 'draft',
    theme_key: 'base',
    version: '1.0.0',
    assets: {},
    token_overrides: {
      'color.brand.primary': { $value: '#ff0000', $type: 'color' },
    },
    layout_overrides: {
      'storefront.home': { hidden_slots: ['cta'] },
    },
    custom_css: 'body { background: red; }',
    updated_at: '2026-08-29T12:30:00Z',
  },
}

describe('Theme Publish and Rollback Route Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/theme/draft')) {
          return Promise.resolve(jsonResponse(MOCK_DRAFT))
        }
        if (url.includes('/tenant/theme/publish')) {
          return Promise.resolve(
            jsonResponse({
              ...MOCK_DRAFT.theme,
              revision: 3,
              state: 'live',
            }),
          )
        }
        if (url.includes('/tenant/theme/rollback')) {
          return Promise.resolve(
            jsonResponse({
              ...MOCK_DRAFT.theme,
              revision: 1,
              state: 'live',
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

  it('renders diff summary listing changed fields', async () => {
    render(ThemePublish)
    expect(await screen.findByText(/Token overrides changed/i)).toBeInTheDocument()
    expect(screen.getByText(/Layout overrides changed/i)).toBeInTheDocument()
    expect(screen.getByText(/Custom CSS changed/i)).toBeInTheDocument()
  })

  it('surfaces 400 contrast errors as actionable messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/theme/draft')) {
          return Promise.resolve(jsonResponse(MOCK_DRAFT))
        }
        if (url.includes('/tenant/theme/publish')) {
          return Promise.resolve(
            jsonResponse(
              {
                title: 'Contrast failure',
                detail: 'Contrast ratio 2.1:1 below 4.5:1',
                status: 400,
              },
              400,
            ),
          )
        }
        return Promise.resolve(jsonResponse({}, 404))
      }),
    )

    render(ThemePublish)
    const publishButton = await screen.findByRole('button', { name: 'Publish Changes' })
    await fireEvent.click(publishButton)

    expect(
      await screen.findByText(/Cannot publish: color contrast requirements not met/i),
    ).toBeInTheDocument()
  })

  it('surfaces 409 rollback failure when no prior revision exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/tenant/theme/draft')) {
          return Promise.resolve(jsonResponse(MOCK_DRAFT))
        }
        if (url.includes('/tenant/theme/rollback')) {
          return Promise.resolve(
            jsonResponse(
              {
                title: 'Conflict',
                detail: 'No previous revision',
                status: 409,
              },
              409,
            ),
          )
        }
        return Promise.resolve(jsonResponse({}, 404))
      }),
    )

    render(ThemePublish)
    const rollbackButton = await screen.findByRole('button', {
      name: 'Rollback to Previous Version',
    })
    await fireEvent.click(rollbackButton)

    // Open confirmation dialog and confirm
    const confirmButton = await screen.findByRole('button', { name: 'Confirm' })
    await fireEvent.click(confirmButton)

    expect(await screen.findByText(/No previous revision available/i)).toBeInTheDocument()
  })

  it('passes axe accessibility checks', async () => {
    const { container } = render(ThemePublish)
    await screen.findByRole('heading', { name: 'Publish Theme' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
