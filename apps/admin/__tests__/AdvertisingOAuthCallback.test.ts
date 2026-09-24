import { setLocale } from '@sanvi/i18n'
import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OAuthCallback from '../src/routes/advertising/OAuthCallback.svelte'

describe('Advertising OAuth callback route (phase 10, TASK-011)', () => {
  const ORIGINAL_LOCATION = window.location

  function stubLocation(search = ''): void {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:4175', search },
    })
  }

  beforeEach(async () => {
    await setLocale('en')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: ORIGINAL_LOCATION,
    })
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders a distinct cancellation state when the platform returns access_denied', async () => {
    stubLocation('?error=access_denied')
    const { container } = render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText('The connection request was cancelled on the platform.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No permissions were granted — you can safely start again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders a generic platform error state for other error values', async () => {
    stubLocation('?error=server_error')
    const { container } = render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(
        'The platform reported an error during authorization. Start again from the connections screen.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders missing params state when neither state nor code is present', async () => {
    stubLocation('')
    const { container } = render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(
        "The platform's response was incomplete — the connection was not made. Start again from the connections screen.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  /**
   * TASK-024: a forged `state` (one the backend never minted) must die at
   * the backend's 400 — rendered as a restartable error, never retried
   * (a retry would replay the consumed code) and never navigated on. The
   * redemption request itself must carry *this app's* callback as
   * `redirect_uri`, so an attacker-chosen redirect can never enter the
   * exchange.
   */
  it('rejects a forged state: backend 400 renders a restartable error, self-origin redirect_uri only, no retry', async () => {
    stubLocation('?state=attacker-forged-state&code=stolen-auth-code')

    const redemptionUrls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/oauth/callback')) {
        redemptionUrls.push(url)
        return new Response(JSON.stringify({ title: 'Bad Request', status: 400 }), {
          status: 400,
          headers: { 'content-type': 'application/problem+json' },
        })
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(
        'The connection could not be confirmed. The request may have expired or already been used — start again from the connections screen.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()

    // The one redemption attempt carried the self-origin callback path as
    // redirect_uri — the attacker-controlled `state` went to the backend to
    // be *rejected*, not obeyed.
    expect(redemptionUrls).toHaveLength(1)
    const sent = new URL(redemptionUrls[0])
    expect(sent.searchParams.get('redirect_uri')).toBe(
      'http://localhost:4175/advertising/connect/meta/callback',
    )
    expect(sent.searchParams.get('state')).toBe('attacker-forged-state')
  })
})
