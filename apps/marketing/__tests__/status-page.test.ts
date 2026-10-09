import { render, screen } from '@testing-library/svelte'
import { ensureLocaleLoaded, setLocale } from '@sanvi/i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatusPage from '../src/routes/status/+page.svelte'

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const OK_STATES = { status: 'ok', checks: [{ name: 'database', state: 'ok' }] }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('marketing status page (TASK-025 step 2)', () => {
  it('renders the operational state from live readiness in English', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(OK_STATES)))
    const view = render(StatusPage, {
      props: {
        data: {
          readiness: OK_STATES,
          loadError: false,
          builtAt: '2026-10-09T00:00:00Z',
          incidents: [],
        },
      },
    })
    try {
      expect(await screen.findByRole('heading', { name: 'System status' })).toBeInTheDocument()
      expect(document.querySelector('[data-status="operational"]')).toBeInTheDocument()
      // The hosting limitation is documented on the page itself.
      expect(screen.getByText(/same infrastructure it reports on/)).toBeInTheDocument()
      expect(screen.getByText('No incidents recorded.')).toBeInTheDocument()
    } finally {
      view.unmount()
    }
  })

  it('with the API down still renders the unknown state rather than crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const view = render(StatusPage, {
      props: {
        data: { readiness: null, loadError: true, builtAt: '2026-10-09T00:00:00Z', incidents: [] },
      },
    })
    try {
      expect(await screen.findByRole('heading', { name: 'System status' })).toBeInTheDocument()
      expect(document.querySelector('[data-status="unknown"]')).toBeInTheDocument()
      expect(screen.getByText(/same infrastructure it reports on/)).toBeInTheDocument()
    } finally {
      view.unmount()
    }
  })

  it('renders in Japanese', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(OK_STATES)))
    await ensureLocaleLoaded('ja')
    await setLocale('ja')
    const view = render(StatusPage, {
      props: {
        data: {
          readiness: OK_STATES,
          loadError: false,
          builtAt: '2026-10-09T00:00:00Z',
          incidents: [],
        },
      },
    })
    try {
      expect(await screen.findByRole('heading', { name: 'システムステータス' })).toBeInTheDocument()
      expect(screen.getByText(/同じインフラ/)).toBeInTheDocument()
    } finally {
      view.unmount()
      await setLocale('en')
    }
  })
})
