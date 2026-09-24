import { setLocale } from '@sanvi/i18n'
import { render, screen, waitFor } from '@testing-library/svelte'
import { fireEvent } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '../src/routes/Login.svelte'

/**
 * TASK-024: the phase-02 OAuth handoff must reject an injected redirect
 * target. `?return_to` is fully attacker-controlled, so the post-login
 * navigation may only ever be a *path on this app* (`safeReturnTo`'s rule):
 * absolute URLs, protocol-relative (`//evil.example`), and backslash forms
 * (`/\evil.example`) must all fall back to `/` — here proven at the actual
 * handoff point, the post-submit `window.location.href` assignment, not
 * just in the guard's unit test.
 */

const KRATOS_FLOW = {
  id: 'login-flow-e2e',
  type: 'browser',
  state: 'show_form',
  expires_at: '2027-01-01T00:00:00Z',
  issued_at: '2026-01-01T00:00:00Z',
  ui: {
    action: 'http://acme.localhost:4433/self-service/login?flow=login-flow-e2e',
    method: 'POST',
    messages: [],
    nodes: [
      {
        type: 'input',
        group: 'password',
        attributes: { node_type: 'input', name: 'password', type: 'password', required: true },
        meta: { label: { id: 1, text: 'Password', type: 'info' } },
        messages: [],
      },
      {
        type: 'input',
        group: 'password',
        attributes: { node_type: 'input', name: 'identifier', type: 'text', required: true },
        meta: { label: { id: 2, text: 'Email', type: 'info' } },
        messages: [],
      },
      {
        type: 'submit',
        group: 'password',
        attributes: { node_type: 'input', name: 'method', value: 'password', type: 'submit' },
        meta: { label: { id: 3, text: 'Sign in', type: 'info' } },
        messages: [],
      },
    ],
  },
}

const ORIGINAL_LOCATION = window.location

describe('login OAuth handoff vs. redirect injection (TASK-024)', () => {
  let assigned: string[] = []
  let fetchMock: ReturnType<typeof vi.fn>

  function stubLocation(search: string): void {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'http://localhost:4175',
        pathname: '/login',
        search,
        get href() {
          return `http://localhost:4175/login${search}`
        },
        set href(value: string) {
          assigned.push(value)
        },
      },
    })
  }

  function stubKratosSuccess(): void {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const isFlowStart = url.includes('/self-service/login/browser')
      const isSubmit = url.includes('/self-service/login?flow=')
      if (isFlowStart || isSubmit) {
        return new Response(JSON.stringify(KRATOS_FLOW), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  beforeEach(async () => {
    await setLocale('en')
    assigned = []
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION })
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function submitLoginForm(): Promise<void> {
    render(Login)
    await screen.findByLabelText(/Password/i)
    await fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }))
    await waitFor(() => expect(assigned.length).toBeGreaterThan(0))
  }

  it.each([
    ['an absolute URL', '?return_to=https://evil.example/grab'],
    ['a protocol-relative URL', '?return_to=//evil.example/grab'],
    ['a backslash form', '?return_to=/\\evil.example'],
    ['a scheme switch', '?return_to=javascript:alert(1)'],
  ])(
    'an injected redirect target (%s) falls back to the app root, never the injection',
    async (_label, search) => {
      stubLocation(search)
      stubKratosSuccess()

      await submitLoginForm()

      expect(assigned).toEqual(['/'])
    },
  )

  it('a legitimate same-app path is honoured — the guard blocks shapes, not the feature', async () => {
    stubLocation('?return_to=/tenants/dev-acme/billing')
    stubKratosSuccess()

    await submitLoginForm()

    expect(assigned).toEqual(['/tenants/dev-acme/billing'])
  })
})
