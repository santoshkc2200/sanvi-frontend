import { setLocale } from '@sanvi/i18n'
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

  beforeEach(() => {
    setLocale('en')
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
    render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText('The connection request was cancelled on the platform.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No permissions were granted — you can safely start again.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
  })

  it('renders a generic platform error state for other error values', async () => {
    stubLocation('?error=server_error')
    render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(
        'The platform reported an error during authorization. Start again from the connections screen.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
  })

  it('renders missing params state when neither state nor code is present', async () => {
    stubLocation('')
    render(OAuthCallback, { props: { platform: 'meta' } })

    expect(
      await screen.findByText(
        "The platform's response was incomplete — the connection was not made. Start again from the connections screen.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to connections' })).toBeInTheDocument()
  })
})
