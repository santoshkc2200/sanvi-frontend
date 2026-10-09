import { describe, expect, it, vi } from 'vitest'
import { OfflineActionQueue, type QueuedAction } from '../src/offline'
import { ApiError } from '../src/problem'

function action(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: 'action-1',
    method: 'POST',
    path: '/v1/things',
    body: { name: 'x' },
    idempotencyKey: 'idem-1',
    ...overrides,
  }
}

/** An in-memory storage double standing in for `localStorage`. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

describe('OfflineActionQueue', () => {
  it('accepts a mutation that carries an idempotency key — it cannot execute twice', () => {
    const queue = new OfflineActionQueue({
      client: { request: vi.fn() },
      storage: fakeStorage(),
    })
    const result = queue.enqueue(action())
    expect(result.accepted).toBe(true)
    expect(queue.pending).toHaveLength(1)
  })

  it('refuses a mutation without an idempotency key — nothing is queued that could execute twice', () => {
    const queue = new OfflineActionQueue({
      client: { request: vi.fn() },
      storage: fakeStorage(),
    })
    const result = queue.enqueue(action({ idempotencyKey: undefined }))
    expect(result.accepted).toBe(false)
    expect(queue.pending).toHaveLength(0)
  })

  it('never queues the same action id twice', () => {
    const queue = new OfflineActionQueue({
      client: { request: vi.fn() },
      storage: fakeStorage(),
    })
    expect(queue.enqueue(action()).accepted).toBe(true)
    expect(queue.enqueue(action()).accepted).toBe(false)
    expect(queue.pending).toHaveLength(1)
  })

  it('replays a queued action exactly once after reconnect, with the same idempotency key', async () => {
    const request = vi.fn().mockResolvedValue({ id: '1' })
    const queue = new OfflineActionQueue({ client: { request }, storage: fakeStorage() })
    queue.enqueue(action({ idempotencyKey: 'dsr-2026-10-09' }))

    await queue.flush()
    await queue.flush() // a second flush (or a duplicated reconnect event) must not re-send

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(
      '/v1/things',
      expect.objectContaining({
        method: 'POST',
        body: { name: 'x' },
        idempotencyKey: 'dsr-2026-10-09',
      }),
    )
    expect(queue.pending).toHaveLength(0)
  })

  it('executes queued actions strictly one at a time and keeps order', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const order: string[] = []
    const request = vi.fn().mockImplementation((path: string) => {
      order.push(path)
      if (order.length === 1) return gate.then(() => ({ ok: 1 }))
      return Promise.resolve({ ok: 2 })
    })
    const queue = new OfflineActionQueue({ client: { request }, storage: fakeStorage() })
    queue.enqueue(action({ id: 'a', path: '/v1/a' }))
    queue.enqueue(action({ id: 'b', path: '/v1/b' }))

    const first = queue.flush()
    const second = queue.flush() // concurrent flush coalesces — no parallel sends
    await Promise.resolve()
    release()
    await Promise.all([first, second])

    expect(request).toHaveBeenCalledTimes(2)
    expect(order).toEqual(['/v1/a', '/v1/b'])
  })

  it('keeps an action whose replay fails retryably, and stops the flush there', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(503, { type: 'about:blank', title: 'x', status: 503 }, undefined),
      )
      .mockResolvedValueOnce({ ok: true })
    const queue = new OfflineActionQueue({ client: { request }, storage: fakeStorage() })
    queue.enqueue(action({ id: 'a' }))
    queue.enqueue(action({ id: 'b' }))

    await queue.flush()
    expect(queue.pending).toHaveLength(2)

    await queue.flush()
    expect(request).toHaveBeenCalledTimes(3)
    expect(queue.pending).toHaveLength(0)
  })

  it('drops an action whose failure is permanent, reporting it instead of looping forever', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          422,
          { type: 'about:blank', title: 'Validation failed', status: 422 },
          undefined,
        ),
      )
    const events: string[] = []
    const queue = new OfflineActionQueue({
      client: { request },
      storage: fakeStorage(),
      onEvent: (event) => events.push(event.kind),
    })
    queue.enqueue(action())

    await queue.flush()

    expect(queue.pending).toHaveLength(0)
    expect(events).toEqual(['enqueued', 'failed'])
  })

  it('survives a reload through its storage — the pending set round-trips', () => {
    const storage = fakeStorage()
    const first = new OfflineActionQueue({ client: { request: vi.fn() }, storage })
    first.enqueue(action({ id: 'persist-me' }))

    // A "reload" constructs a fresh queue over the same storage.
    const second = new OfflineActionQueue({ client: { request: vi.fn() }, storage })
    expect(second.pending.map((a) => a.id)).toEqual(['persist-me'])
  })

  it('ignores a corrupt persisted payload instead of throwing on boot', () => {
    const storage = fakeStorage()
    storage.setItem('sanvi:offline-queue', '{not json')
    const queue = new OfflineActionQueue({ client: { request: vi.fn() }, storage })
    expect(queue.pending).toHaveLength(0)
  })
})
