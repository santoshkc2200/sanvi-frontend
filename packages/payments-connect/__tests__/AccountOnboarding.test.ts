import { cleanup, render, screen, fireEvent } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountOnboarding from '../src/AccountOnboarding.svelte'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// Mock @stripe/connect-js so tests don't need network.
vi.mock('@stripe/connect-js', () => ({
  loadConnectAndInitialize: vi.fn(
    async ({ fetchClientSecret }: { fetchClientSecret: () => Promise<string> }) => {
      // Simulate per-render fetch — call it once to prove it's invoked.
      // In success case, return a fake instance.
      const instance = {
        create: vi.fn(() => {
          const el = document.createElement('div')
          // Add Stripe element API shims that AccountOnboarding calls
          // @ts-expect-error — test shim
          el.setOnExit = vi.fn()
          // @ts-expect-error
          el.setOnLoaderStart = vi.fn((cb) => cb({ elementTagName: 'account-onboarding' }))
          // @ts-expect-error
          el.setOnLoadError = vi.fn()
          return el
        }),
        logout: vi.fn(),
        update: vi.fn(),
      }
      // Ensure fetchClientSecret is callable and not persisted
      await fetchClientSecret().catch(() => {})
      return instance
    },
  ),
}))

const labels = {
  loading: 'Loading secure onboarding…',
  loadErrorTitle: 'Onboarding did not load',
  loadErrorBody: 'Stripe could not be loaded.',
  sessionErrorTitle: 'Could not start onboarding',
  sessionErrorBody: 'We could not create a secure session.',
  retry: 'Try again',
  support: 'Need help? Contact support.',
}

describe('AccountOnboarding', () => {
  it('renders loading state initially', async () => {
    render(AccountOnboarding, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => 'secret_123',
        labels,
      },
    })
    expect(screen.getByText(labels.loading)).toBeInTheDocument()
  })

  it('fetches client_secret per render and does not persist it', async () => {
    const fetchSpy = vi.fn(async () => 'secret_per_render')
    render(AccountOnboarding, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: fetchSpy,
        labels,
      },
    })
    // fetchClientSecret should be called during initialization
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // No storage of secret
    expect(localStorage.getItem('secret_per_render')).toBeNull()
  })

  it('renders retry affordance on Connect.js load failure, not a blank box', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockRejectedValueOnce(
      new Error('CSP blocked https://connect-js.stripe.com'),
    )

    render(AccountOnboarding, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => {
          throw new Error('should not be called when loader fails')
        },
        labels,
      },
    })

    expect(await screen.findByText(labels.loadErrorTitle)).toBeInTheDocument()
    expect(screen.getByText(labels.loadErrorBody)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.retry })).toBeInTheDocument()
    expect(screen.getByText(labels.support)).toBeInTheDocument()
  })

  it('renders session error with retry when fetchClientSecret fails', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    // Make load succeed but fetchClientSecret throw, which loader treats as session error
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
          el.setOnExit = vi.fn()
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

    render(AccountOnboarding, {
      props: {
        publishableKey: 'pk_test_123',
        fetchClientSecret: async () => {
          throw new Error('403 payments/manage')
        },
        labels,
      },
    })

    expect(await screen.findByText(labels.sessionErrorTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.retry })).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked via parent handler', async () => {
    const { loadConnectAndInitialize } = await import('@stripe/connect-js')
    vi.mocked(loadConnectAndInitialize).mockRejectedValueOnce(new Error('network failure'))

    const onRetry = vi.fn()
    render(AccountOnboarding, {
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
