import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(import.meta.dirname, '../../..')

function read(...parts: string[]): string {
  return readFileSync(join(repoRoot, ...parts), 'utf8')
}

describe('payments-connect security: client_secret handling', () => {
  it('never writes client_secret to localStorage, sessionStorage, cookie, or console', () => {
    const sources = [
      read('packages/payments-connect/src/loader.ts'),
      read('packages/payments-connect/src/AccountOnboarding.svelte'),
      read('apps/admin/src/routes/PaymentsSettings.svelte'),
      read('apps/admin/src/lib/payments/providerRegistry.ts'),
      read('packages/api-client/src/payments.ts'),
    ].join('\n')

    // The secret is returned and used, never persisted.
    expect(sources).not.toMatch(/localStorage\s*\.\s*setItem[^;]*client_secret/)
    expect(sources).not.toMatch(/sessionStorage\s*\.\s*setItem[^;]*client_secret/)
    // Allow no document.cookie write at all in these files (broader guard)
    const writesCookie = /document\s*\.\s*cookie\s*=/.test(sources)
    expect(writesCookie).toBe(false)
    // No console.log of the secret
    expect(sources).not.toMatch(/console\s*\.\s*log[^;]*client_secret/)
    expect(sources).not.toMatch(/console\s*\.\s*debug[^;]*client_secret/)
    expect(sources).not.toMatch(/console\s*\.\s*info[^;]*client_secret/)
  })

  it('fetchClientSecret is called per render and not cached (loader contains no cache)', () => {
    const loader = read('packages/payments-connect/src/loader.ts')
    // Should not contain a Map/cache for client_secret
    expect(loader).not.toMatch(/cache.*client_secret/i)
    expect(loader).not.toMatch(/Map.*client_secret/)
  })

  it('never derives payment readiness from capability strings on frontend (TASK-004 / FR-903)', () => {
    const adminSources = [
      read('apps/admin/src/routes/PaymentsSettings.svelte'),
      read('apps/admin/src/lib/payments/PaymentConnectionStatus.svelte'),
      read('apps/admin/src/lib/payments/providerRegistry.ts'),
      read('apps/admin/src/lib/payments/poll.ts'),
    ].join('\n')

    // can_accept_payments must be read directly from the API, never recomputed from capability strings
    expect(adminSources).not.toMatch(/card_payments.*===.*['"]active['"].*can_accept/i)
    expect(adminSources).not.toMatch(/can_accept_payments\s*=\s*.*capabilities/i)
    expect(adminSources).not.toMatch(/capabilities\s*\[\s*['"]card_payments['"]\s*\]\s*===/)
  })
})
