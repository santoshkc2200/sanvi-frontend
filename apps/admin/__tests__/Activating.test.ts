import { axe } from '@sanvi/test-config/axe'
import { render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Activating from '../src/routes/Activating.svelte'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Admin Activating Route Component', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders initial polling state and transitions on active subscription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          subscription_id: 'sub-active',
          status: 'active',
          plan_key: 'starter',
          plan_name: 'Starter',
          collection_state: 'ok',
        }),
      ),
    )

    render(Activating)

    expect(screen.getByRole('heading', { name: 'Setting up your workspace' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Workspace ready!' })).toBeInTheDocument()
    })
  })

  it('cancels polling loop and aborts in-flight requests on unmount (Defect 12)', async () => {
    let aborted = false
    let fetchStarted = false
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        fetchStarted = true
        const signal = init?.signal
        if (signal) {
          signal.addEventListener('abort', () => {
            aborted = true
          })
        }
        return new Promise(() => {}) // never settles
      }),
    )

    const { unmount } = render(Activating)
    await waitFor(() => {
      expect(fetchStarted).toBe(true)
    })

    unmount()

    expect(aborted).toBe(true)
  })

  it('has no accessibility violations during initial state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const { container } = render(Activating)
    expect(await axe(container)).toHaveNoViolations()
  })
})
