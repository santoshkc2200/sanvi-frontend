import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * TASK-024: logout must clear session state in *every* open tab, not only
 * the one that clicked the button. The mechanism is a BroadcastChannel
 * broadcast from `logout()`; a receiving tab applies the null session
 * through the same `onSessionChange` listeners a local logout fires.
 */

type MessageHandler = (event: { data: unknown }) => void

/** Fake channels that share one bus — the "tabs" of the test. */
function fakeBroadcastChannelBus() {
  const handlers = new Map<BroadcastChannel, MessageHandler>()
  class FakeChannel {
    name: string
    constructor(name: string) {
      this.name = name
    }
    set onmessage(handler: MessageHandler) {
      handlers.set(this as unknown as BroadcastChannel, handler)
    }
    get onmessage(): MessageHandler {
      return handlers.get(this as unknown as BroadcastChannel) as MessageHandler
    }
    postMessage(data: unknown): void {
      for (const [channel, handler] of handlers) {
        if (channel !== (this as unknown as BroadcastChannel)) handler({ data })
      }
    }
  }
  return { FakeChannel, handlers }
}

const SESSION = {
  userId: 'user-1',
  email: 'alice@example.com',
  emailVerified: true,
  status: 'active' as const,
  memberships: [],
  aal: 'aal1',
  methods: ['password'],
}

const ORIGINAL_LOCATION = window.location

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION })
  vi.unstubAllGlobals()
  vi.doUnmock('../src/kratos/flow')
  vi.resetModules()
})

async function importStoreWithLogoutUrl(logoutUrl: string) {
  vi.doMock('../src/kratos/flow', () => ({
    requestLogoutUrl: vi.fn().mockResolvedValue(logoutUrl),
  }))
  return import('../src/store.svelte')
}

describe('cross-tab logout (TASK-024)', () => {
  it('a signed-out broadcast clears the session in the other tab', {
    timeout: 20_000,
  }, async () => {
    const { FakeChannel, handlers } = fakeBroadcastChannelBus()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const store = await import('../src/store.svelte')

    const listener = vi.fn()
    store.onSessionChange(listener)
    store.setSession(SESSION)
    expect(store.getSession()).not.toBeNull()

    // The other tab signs out — its channel is a different FakeChannel
    // instance, so the message arrives on this tab's handler.
    const otherTab = new BroadcastChannel('sanvi:auth') as BroadcastChannel
    otherTab.postMessage({ type: 'signed-out' })

    expect(store.getSession()).toBeNull()
    expect(listener).toHaveBeenLastCalledWith(null)
    // Only the listening tab has an `onmessage` registered; the broadcast
    // reaches every registered handler except the sender — which is why the
    // receiving tab cleared its session above.
    expect(handlers.size).toBe(1)
  })

  it('the receiving tab does not echo the broadcast back', { timeout: 20_000 }, async () => {
    const { FakeChannel } = fakeBroadcastChannelBus()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const store = await import('../src/store.svelte')
    const postSpy = vi.spyOn(FakeChannel.prototype, 'postMessage')

    const otherTab = new BroadcastChannel('sanvi:auth') as BroadcastChannel
    otherTab.postMessage({ type: 'signed-out' })

    // Exactly the originating tab's post — no reply from this tab's
    // receiver, which would ping-pong between tabs forever.
    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(store.getSession()).toBeNull()
  })

  it('logout() broadcasts the sign-out it applies locally', { timeout: 20_000 }, async () => {
    const { FakeChannel } = fakeBroadcastChannelBus()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const postSpy = vi.spyOn(FakeChannel.prototype, 'postMessage')
    const { logout, setSession, getSession } = await importStoreWithLogoutUrl(
      'https://kratos.example.test/logout',
    )
    setSession(SESSION)

    const navigatedTo: string[] = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...ORIGINAL_LOCATION,
        set href(value: string) {
          navigatedTo.push(value)
        },
      },
    })
    await logout({} as never)

    expect(postSpy).toHaveBeenCalledWith({ type: 'signed-out' })
    expect(getSession()).toBeNull()
    expect(navigatedTo).toEqual(['https://kratos.example.test/logout'])
  })

  it('tabs without BroadcastChannel still log out — the broadcast is an enhancement, not a dependency', {
    timeout: 20_000,
  }, async () => {
    // No BroadcastChannel global (jsdom's default): logout must not throw,
    // and the local session still clears.
    const { logout, setSession, getSession } = await importStoreWithLogoutUrl(
      'https://kratos.example.test/logout',
    )
    setSession(SESSION)

    const navigatedTo: string[] = []
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...ORIGINAL_LOCATION,
        set href(value: string) {
          navigatedTo.push(value)
        },
      },
    })
    await expect(logout({} as never)).resolves.toBeUndefined()

    expect(getSession()).toBeNull()
    expect(navigatedTo).toEqual(['https://kratos.example.test/logout'])
  })
})
