import { describe, expect, it, vi } from 'vitest'
import { SCRIPT_REVOKED_EVENT, ScriptBlockedError, createScriptGate } from '../src/loader'
import type { ScriptRevokedDetail } from '../src/loader'
import type { DirectiveSnapshot } from '../src/purposes'
import { ConsentStore } from '../src/store'

/**
 * The gate runs against a minimal `DocumentLike`, so these tests run in the
 * plain node environment with hand-rolled fakes instead of jsdom — the
 * loader only needs createElement/head/event plumbing.
 */

interface FakeElement {
  src: string
  async: boolean
  dataset: Record<string, string>
  attrs: Record<string, string>
  removed: boolean
  setAttribute: (name: string, value: string) => void
  addEventListener: (type: string, fn: () => void) => void
  remove: () => void
  dispatch: (type: string) => void
}

function fakeScriptElement(): FakeElement {
  const listeners = new Map<string, (() => void)[]>()
  const element: FakeElement = {
    src: '',
    async: false,
    dataset: {},
    attrs: {},
    removed: false,
    setAttribute(name, value) {
      element.attrs[name] = value
    },
    addEventListener(type, fn) {
      const existing = listeners.get(type) ?? []
      existing.push(fn)
      listeners.set(type, existing)
    },
    remove() {
      element.removed = true
    },
    dispatch(type) {
      for (const fn of listeners.get(type) ?? []) fn()
    },
  }
  return element
}

function fakeDoc() {
  const created: FakeElement[] = []
  const headListeners = new Map<string, ((event: CustomEvent<ScriptRevokedDetail>) => void)[]>()
  const head = {
    appendChild: (child: Node) => {
      // appended at creation by the loader — nothing to do beyond tracking
      void child
    },
    addEventListener: (type: string, fn: (event: CustomEvent<ScriptRevokedDetail>) => void) => {
      const existing = headListeners.get(type) ?? []
      existing.push(fn)
      headListeners.set(type, existing)
    },
    dispatchEvent: (event: CustomEvent<ScriptRevokedDetail>) => {
      for (const fn of headListeners.get(event.type) ?? []) fn(event)
      return true
    },
  } as unknown as HTMLElement
  const doc = {
    createElement: (): HTMLScriptElement => {
      const element = fakeScriptElement()
      created.push(element)
      return element as unknown as HTMLScriptElement
    },
    head,
  }
  return { doc: doc as unknown as Document, head, created, headListeners }
}

function snapshot(us = false): DirectiveSnapshot {
  const jurisdiction = us ? 'us-ca' : 'eu'
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction,
    directives: [
      {
        purpose: 'essential',
        state: 'allowed',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction,
      },
      {
        purpose: 'analytics',
        state: us ? 'allowed' : 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction,
        notice_version: '2026.1',
      },
      {
        purpose: 'sale_or_share',
        state: us ? 'allowed' : 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction,
        notice_version: '2026.1',
      },
    ],
    honours_universal_opt_out: true,
  }
}

const ALLOWED_SRC = 'https://cdn.example.com/analytics.js'

describe('script gate', () => {
  it('loads an allowed script when its purpose is allowed', async () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const { doc, created } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    const promise = gate.load({ src: ALLOWED_SRC, purposes: ['analytics'] })
    expect(created).toHaveLength(1)
    created[0]!.dispatch('load')
    await expect(promise).resolves.toBeDefined()
    expect(gate.isLoaded(ALLOWED_SRC)).toBe(true)
  })

  it('copies allow-listed attributes onto the element and marks it gated', async () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const { doc, created } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    void gate.load({
      src: ALLOWED_SRC,
      purposes: ['analytics'],
      attributes: { 'data-integration': 'test' },
    })
    const element = created[0]!
    expect(element.dataset['sanviGated']).toBe('true')
    expect(element.attrs['data-integration']).toBe('test')
  })

  it('refuses — never queues — when a purpose is not allowed', async () => {
    const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
    const { doc, created } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    await expect(gate.load({ src: ALLOWED_SRC, purposes: ['analytics'] })).rejects.toBeInstanceOf(
      ScriptBlockedError,
    )
    expect(created).toHaveLength(0)
  })

  it('refuses URLs outside the allow-list even when purposes are allowed', async () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const { doc } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    await expect(
      gate.load({ src: 'https://evil.example.com/pixel.js', purposes: ['analytics'] }),
    ).rejects.toThrow(/allow-list/)
  })

  it('a US GPC signal blocks sale/share purposes from first paint', async () => {
    const store = new ConsentStore({
      snapshot: snapshot(true),
      consentModel: 'notice_and_opt_out',
      gpc: true,
    })
    const { doc } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    await expect(gate.load({ src: ALLOWED_SRC, purposes: ['sale_or_share'] })).rejects.toThrow(
      /not allowed/,
    )
  })

  it('revocation removes the element and announces it for integration cleanup', async () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const { doc, head, created } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    const promise = gate.load({ src: ALLOWED_SRC, purposes: ['analytics'] })
    created[0]!.dispatch('load')
    await promise

    const revoked = vi.fn()
    head.addEventListener(SCRIPT_REVOKED_EVENT, revoked)

    store.setDecision('analytics', false)
    expect(created[0]!.removed).toBe(true)
    expect(gate.isLoaded(ALLOWED_SRC)).toBe(false)
    expect(revoked).toHaveBeenCalledTimes(1)
    const event = revoked.mock.calls[0]?.[0] as CustomEvent<ScriptRevokedDetail> | undefined
    expect(event?.detail).toEqual({
      src: ALLOWED_SRC,
      purposes: ['analytics'],
    })
  })

  it('shares one in-flight request for a repeated load of the same src', async () => {
    const store = new ConsentStore({ snapshot: snapshot(true), consentModel: 'notice_and_opt_out' })
    const { doc, created } = fakeDoc()
    const gate = createScriptGate({ store, allowList: [ALLOWED_SRC], doc })

    const first = gate.load({ src: ALLOWED_SRC, purposes: ['analytics'] })
    const second = gate.load({ src: ALLOWED_SRC, purposes: ['analytics'] })
    expect(created).toHaveLength(1)
    created[0]!.dispatch('load')
    await expect(first).resolves.toBeDefined()
    await expect(second).resolves.toBeDefined()
    expect(created).toHaveLength(1)
  })
})
