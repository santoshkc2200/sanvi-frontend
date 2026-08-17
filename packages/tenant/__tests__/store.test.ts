import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getActiveMembership,
  getActiveTenantId,
  getMemberships,
  hasFeature,
  onTenantSwitch,
  requireActiveMembership,
  setMemberships,
  switchTenant,
} from '../src/store.svelte'
import type { TenantMembership } from '../src/types'

const ACME: TenantMembership = {
  tenantId: 'acme-1',
  slug: 'acme',
  displayName: 'Acme',
  role: 'owner',
}
const GLOBEX: TenantMembership = {
  tenantId: 'globex-1',
  slug: 'globex',
  displayName: 'Globex',
  role: 'admin',
}

describe('tenant switcher store', () => {
  beforeEach(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: test cleanup for the cookie `store.svelte.ts` deliberately writes via `document.cookie`.
    document.cookie = 'sanvi_tenant=; path=/; max-age=0'
    setMemberships([ACME, GLOBEX])
    switchTenant('acme-1')
  })

  afterEach(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: see beforeEach.
    document.cookie = 'sanvi_tenant=; path=/; max-age=0'
  })

  it('lists the configured memberships', () => {
    expect(getMemberships()).toEqual([ACME, GLOBEX])
  })

  it('switchTenant updates the active tenant and persists it to a cookie', () => {
    switchTenant('globex-1')

    expect(getActiveTenantId()).toBe('globex-1')
    expect(getActiveMembership()).toEqual(GLOBEX)
    expect(document.cookie).toContain('sanvi_tenant=globex-1')
  })

  it('switchTenant rejects a tenant id outside the membership list', () => {
    expect(() => switchTenant('not-a-member')).toThrow(/not in the current membership list/)
  })

  it('requireActiveMembership throws once there is no membership list left', () => {
    setMemberships([])
    expect(() => requireActiveMembership()).toThrow(/no active tenant selected/)
  })

  it('notifies onTenantSwitch listeners, and the returned unsubscribe stops future notifications', () => {
    const listener = vi.fn()
    const unsubscribe = onTenantSwitch(listener)

    switchTenant('globex-1')
    expect(listener).toHaveBeenCalledWith('globex-1')

    unsubscribe()
    switchTenant('acme-1')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hasFeature stub reads as available until phase 03 wires real entitlements', () => {
    expect(hasFeature('anything')).toBe(true)
  })
})
