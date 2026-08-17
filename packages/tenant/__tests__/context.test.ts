import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { TenantContext } from '../src/types'
import TenantContextProvider from './fixtures/TenantContextProvider.svelte'
import TenantContextRequireConsumer from './fixtures/TenantContextRequireConsumer.svelte'

const TENANT: TenantContext = {
  tenant_id: '11111111-1111-1111-1111-111111111111',
  slug: 'acme',
  display_name: 'Acme Corporation',
  status: 'active',
  region: 'us',
  default_locale: 'en',
  resolution_source: 'subdomain',
}

describe('tenant context (SvelteKit-safe, per-tree)', () => {
  it('a descendant reads the tenant set by an ancestor', () => {
    render(TenantContextProvider, { props: { tenant: TENANT } })
    expect(screen.getByTestId('consumer').textContent).toBe('acme')
  })

  it('a descendant reads null when the ancestor set no tenant (unknown-host branch)', () => {
    render(TenantContextProvider, { props: { tenant: null } })
    expect(screen.getByTestId('consumer').textContent).toBe('none')
  })

  it('requireTenantContext() throws outside a resolved tenant tree', () => {
    expect(() => render(TenantContextRequireConsumer)).toThrow(
      /requireTenantContext\(\) called outside a resolved tenant context/,
    )
  })
})
