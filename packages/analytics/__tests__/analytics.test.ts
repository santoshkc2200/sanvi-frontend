import { describe, expect, it, vi } from 'vitest'
import { ConsentStore } from '@sanvi/consent'
import type { DirectiveSnapshot } from '@sanvi/consent'
import { KNOWN_PII_PROPS, PiiViolationError, createAnalytics } from '../src/analytics'

function snapshot(us = false): DirectiveSnapshot {
  const jurisdiction = us ? 'us-ca' : 'eu'
  return {
    subject: { key: 'subject-1', kind: 'device', identifiers: [] },
    jurisdiction,
    directives: [
      {
        purpose: 'analytics',
        state: us ? 'allowed' : 'denied',
        source: 'default',
        effective_at: '2026-01-01T00:00:00Z',
        jurisdiction,
        notice_version: '2026.1',
      },
      {
        purpose: 'ads_measurement',
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
      {
        purpose: 'targeted_advertising',
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

function euAnalytics() {
  const store = new ConsentStore({ snapshot: snapshot(false), consentModel: 'opt_in' })
  const sink = vi.fn()
  return { store, sink, analytics: createAnalytics({ store, sink }) }
}

describe('purpose gating', () => {
  it('drops events when the purpose is not allowed — no sink call, no queue', () => {
    const { analytics, sink } = euAnalytics()
    analytics.track('page_view')
    expect(sink).not.toHaveBeenCalled()
    expect(analytics.droppedCount()).toBe(1)
  })

  it('sends events once the purpose is granted', () => {
    const { store, analytics, sink } = euAnalytics()
    store.acceptAll()
    analytics.track('page_view', { path: '/home' })
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      event: 'page_view',
      props: { path: '/home' },
      purpose: 'analytics',
    })
  })

  it('drops on revocation — the event is gone, not deferred', () => {
    const { store, analytics, sink } = euAnalytics()
    store.acceptAll()
    analytics.track('page_view')
    expect(sink).toHaveBeenCalledTimes(1)
    store.setDecision('analytics', false)
    analytics.track('page_view')
    expect(sink).toHaveBeenCalledTimes(1) // unchanged
    expect(analytics.droppedCount()).toBe(1)
  })

  it('the same call is gated by an EU absence of consent and a US opt-out alike', () => {
    const usStore = new ConsentStore({
      snapshot: snapshot(true),
      consentModel: 'notice_and_opt_out',
    })
    const usSink = vi.fn()
    const us = createAnalytics({ store: usStore, sink: usSink })
    // US defaults allow analytics — the caller doesn't know a jurisdiction resolved.
    us.track('page_view')
    expect(usSink).toHaveBeenCalledTimes(1)
    usStore.optOut('ui') // flips sale/share family only; analytics untouched
    us.track('page_view')
    expect(usSink).toHaveBeenCalledTimes(2)
    us.track('audience_ping', {}, 'targeted_advertising')
    expect(usSink).toHaveBeenCalledTimes(2) // dropped: opted out
  })

  it('ad purposes additionally require sale/share to be allowed via the integration path', () => {
    const usStore = new ConsentStore({
      snapshot: snapshot(true),
      consentModel: 'notice_and_opt_out',
    })
    const analytics = createAnalytics({ store: usStore, sink: vi.fn() })
    const revoke = vi.fn()
    const init = vi.fn()
    analytics.registerIntegration({
      id: 'audience-adapter',
      purposes: ['ads_measurement', 'sale_or_share'],
      init,
      revoke,
    })
    expect(init).toHaveBeenCalled() // allowed by default in US mode
    usStore.optOut('ui')
    expect(revoke).toHaveBeenCalled() // synchronous, same tick as the decision
    expect(init).toHaveBeenCalledTimes(1)
  })
})

describe('payload schema and PII', () => {
  it('rejects known-PII prop names loudly instead of stripping them', () => {
    const { store, analytics } = euAnalytics()
    store.acceptAll()
    for (const prop of ['email', 'user_id', 'IP_ADDRESS']) {
      expect(() => analytics.track('signup', { [prop]: 'x' })).toThrow(PiiViolationError)
    }
  })

  it('knows the PII list it enforces', () => {
    expect(KNOWN_PII_PROPS).toContain('email')
    expect(KNOWN_PII_PROPS).toContain('session_id')
  })

  it('drops events with non-flat payloads (objects, arrays, functions)', () => {
    const { store, analytics, sink } = euAnalytics()
    store.acceptAll()
    analytics.track('bad', { nested: { a: 1 } })
    analytics.track('bad', { items: [{ a: 1 }] })
    analytics.track('bad', { fn: () => {} })
    expect(sink).not.toHaveBeenCalled()
    expect(analytics.droppedCount()).toBe(3)
  })

  it('accepts flat string, number, boolean and null props', () => {
    const { store, analytics, sink } = euAnalytics()
    store.acceptAll()
    analytics.track('order', { count: 2, paid: true, label: 'ok', note: null })
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('rejects empty or oversized event names', () => {
    const { store, analytics, sink } = euAnalytics()
    store.acceptAll()
    analytics.track('')
    analytics.track('x'.repeat(129))
    expect(sink).not.toHaveBeenCalled()
  })
})

describe('integration lifecycle', () => {
  it('does not init an integration whose purposes are denied', () => {
    const { analytics, store } = euAnalytics()
    const init = vi.fn()
    const revoke = vi.fn()
    analytics.registerIntegration({ id: 'ads', purposes: ['sale_or_share'], init, revoke })
    expect(init).not.toHaveBeenCalled() // EU default: sale/share denied
    store.acceptAll()
    expect(init).toHaveBeenCalledTimes(1)
  })

  it('unregistering revokes an active integration', () => {
    const usStore = new ConsentStore({
      snapshot: snapshot(true),
      consentModel: 'notice_and_opt_out',
    })
    const analytics = createAnalytics({ store: usStore, sink: vi.fn() })
    const revoke = vi.fn()
    const unregister = analytics.registerIntegration({
      id: 'audience',
      purposes: ['ads_measurement'],
      init: vi.fn(),
      revoke,
    })
    unregister()
    expect(revoke).toHaveBeenCalled()
    usStore.setDecision('ads_measurement', false)
    expect(revoke).toHaveBeenCalledTimes(1) // no double revoke
  })
})
