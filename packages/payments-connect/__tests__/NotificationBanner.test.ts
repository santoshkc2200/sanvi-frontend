import { cleanup, render, screen, fireEvent } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBanner from '../src/NotificationBanner.svelte'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

vi.mock('@stripe/connect-js', () => ({
  loadConnectAndInitialize: vi.fn(
    async ({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) => {
      const instance = {
        create: vi.fn(() => {
          const el = document.createElement('div')
          // @ts-expect-error — test shim
          el.setOnNotificationsChange = vi.fn()
          // @ts-expect-error
          el.setOnLoaderStart = vi.fn((cb) => cb({ elementTagName: 'notification-banner' }))
          // @ts-expect-error
          el.setOnLoadError = vi.fn()
          return el
        }),
        logout: vi.fn(),
        update: vi.fn(),
      }
      await fetchClientSecret().catch(() => {})
      return instance
    },
  ),
}))

const labels = {
  loading: 'Loading notifications…',
  loadErrorTitle: 'Notification banner did not load',
  loadErrorBody: 'Stripe notification banner could not be loaded.',
  sessionErrorTitle: 'Could not start notifications session',
  sessionErrorBody: 'We could not create a secure session.',
  retry: 'Try again',
  support: 'Need help? Contact support.',
  technicalDetail: 'Technical detail',
}

describe('NotificationBanner', () => {
  it('renders loading state initially', async () => {
    render(NotificationBanner, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => 'secret_123',
        labels,
        onRetry: vi.fn(),
      },
    })
    expect(screen.getByText(labels.loading)).toBeInTheDocument()
  })

  it('fetches client_secret per render and does not persist it', async () => {
    const fetchSpy = vi.fn(async () => 'secret_per_render')
    render(NotificationBanner, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: fetchSpy,
        labels,
        onRetry: vi.fn(),
      },
    })
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('secret_per_render')).toBeNull()
  })

  it('renders retry affordance on Connect.js load failure', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockRejectedValueOnce(
      new Error('CSP blocked https://connect-js.stripe.com'),
    )

    render(NotificationBanner, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => {
          throw new Error('should not be called when loader fails')
        },
        labels,
        onRetry: vi.fn(),
      },
    })

    expect(await screen.findByText(labels.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByText(labels.loadErrorBody)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.retry })).toBeInTheDocument()
    expect(screen.getByText(labels.support)).toBeInTheDocument()
  })

  it('renders session error with retry when fetchClientSecret fails', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockImplementationOnce(async ({ fetchClientSecret }) => {
      try {
        await fetchClientSecret()
      } catch (e) {
        throw new Error(`account_session_create_error: ${(e as Error).message}`)
      }
      return {
        create: () => {
          const el = document.createElement('div')
          // @ts-expect-error
          el.setOnLoaderStart = vi.fn()
          // @ts-expect-error
          el.setOnLoadError = vi.fn()
          return el
        },
        logout: vi.fn(),
        update: vi.fn(),
      } as unknown as never
    })

    render(NotificationBanner, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => {
          throw new Error('403 payments/manage')
        },
        labels,
        onRetry: vi.fn(),
      },
    })

    expect(await screen.findByText(labels.sessionErrorTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.retry })).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockRejectedValueOnce(new Error('network failure'))

    const onRetry = vi.fn()
    render(NotificationBanner, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => 'secret',
        labels,
        onRetry,
      },
    })

    const btn = await screen.findByRole('button', { name: labels.retry })
    await fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
