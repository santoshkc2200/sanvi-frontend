import type { Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * Hermetic backend for the phase-08 domain wizard E2E suites, layered on top
 * of `mock-backend.ts`'s app-boot fixtures. A single route handler branches
 * on URL/method (mirroring the vitest component tests' `vi.fn` fetch mocks)
 * rather than registering one Playwright route per endpoint — Playwright
 * checks routes in reverse registration order, and several domain endpoints
 * share a path prefix (`/tenant/domains`, `/tenant/domains/search`,
 * `/tenant/domains/{id}`, `/tenant/domains/orders`), so one dispatcher avoids
 * getting the registration order wrong. Field shapes mirror
 * `packages/api-client/src/generated/types.ts`; re-check them after
 * `pnpm generate:api`.
 *
 * `domains` and `orders` are mutable arrays the caller seeds and can mutate
 * mid-test (e.g. flip a domain's `status` between polls) since the handler
 * always reads the current array contents, not a snapshot.
 */
export interface DomainsFixtureState {
  domains: Record<string, unknown>[]
  orders: Record<string, unknown>[]
  searchResults: Record<string, unknown>[]
}

export function mockDomainsBackend(page: Page): DomainsFixtureState {
  mockBackend(page)

  const state: DomainsFixtureState = {
    domains: [],
    orders: [],
    searchResults: [],
  }

  page.route('**/api/v1/tenant/domains**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (url.includes('/tenant/domains/search')) {
      await route.fulfill({
        json: { query: 'freshstore', registrar_id: 'sandbox', results: state.searchResults },
      })
      return
    }

    if (url.includes('/tenant/domains/orders/') && url.includes('/auto-renew')) {
      const id = url.match(/\/orders\/([^/?]+)\/auto-renew/)?.[1]
      const order = state.orders.find((o) => o.id === id)
      if (order) order.auto_renew = !order.auto_renew
      await route.fulfill({ json: order ?? {} })
      return
    }

    if (url.includes('/tenant/domains/orders')) {
      if (method === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>
        const newOrder = {
          id: 'ord_e2e_1',
          hostname: body.hostname,
          term_years: body.term_years ?? 1,
          price_minor: 1299,
          currency: 'USD',
          status: 'pending',
          auto_renew: body.auto_renew ?? true,
          whois_privacy: body.whois_privacy ?? true,
          registered_at: null,
          expires_at: null,
          created_at: new Date().toISOString(),
        }
        state.orders = [newOrder]
        await route.fulfill({ json: newOrder, status: 201 })
        return
      }
      await route.fulfill({ json: state.orders })
      return
    }

    if (url.includes('/verify')) {
      await route.fulfill({ json: { status: 'queued' } })
      return
    }

    if (url.includes('/instructions')) {
      const id = url.match(/\/tenant\/domains\/([^/?]+)\/instructions/)?.[1]
      const domain = state.domains.find((d) => d.id === id) ?? state.domains[0]
      const hostname = (domain?.hostname as string) ?? 'example.com'
      await route.fulfill({
        json: {
          domain_id: domain?.id ?? id,
          hostname,
          kind: domain?.kind ?? 'connected',
          role: domain?.role ?? 'primary',
          status: domain?.status ?? 'pending_setup',
          guide: {
            id: 'guide_cloudflare',
            title: 'Cloudflare DNS setup',
            steps: [
              'Open the Cloudflare dashboard and pick this domain.',
              'Open the DNS tab and add the records below.',
              'Save — propagation usually takes 5-30 minutes.',
            ],
          },
          records: [
            {
              record_type: 'TXT',
              name: `_sanvi-challenge.${hostname}`,
              value: 'sanvi-verification=tok_e2e_1',
              ttl: 300,
              explanation: 'Proves you control this domain.',
            },
            {
              record_type: 'CNAME',
              name: hostname,
              value: 'edge.sanvi-cdn.test',
              ttl: 300,
              explanation: 'Routes visitors to your storefront.',
            },
          ],
        },
      })
      return
    }

    if (url.includes('/promote')) {
      const id = url.match(/\/tenant\/domains\/([^/?]+)\/promote/)?.[1]
      const domain = state.domains.find((d) => d.id === id)
      if (domain) domain.role = 'primary'
      await route.fulfill({ json: domain ?? {} })
      return
    }

    // A bare id segment: /tenant/domains/{id} (DELETE) vs the exact
    // /tenant/domains collection (GET list, POST claim).
    const idMatch = url.match(/\/tenant\/domains\/([^/?]+)$/)
    if (idMatch && method === 'DELETE') {
      state.domains = state.domains.filter((d) => d.id !== idMatch[1])
      await route.fulfill({ status: 204 })
      return
    }

    if (method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      const hostname = body.hostname as string
      const newDomain = {
        id: 'dom_e2e_1',
        hostname,
        kind: 'connected',
        role: body.role ?? 'primary',
        status: 'pending_setup',
        detected_registrar: 'cloudflare',
        challenge: {
          challenge_type: 'txt',
          token: 'tok_e2e_1',
          txt_name: `_sanvi-challenge.${hostname}`,
          txt_value: 'sanvi-verification=tok_e2e_1',
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        failure: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      state.domains = [newDomain]
      await route.fulfill({ json: newDomain, status: 201 })
      return
    }

    // GET list — covers both the initial load and every poll tick.
    await route.fulfill({ json: state.domains })
  })

  return state
}
