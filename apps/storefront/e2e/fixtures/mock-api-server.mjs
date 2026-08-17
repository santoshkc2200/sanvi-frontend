#!/usr/bin/env node
/**
 * A tiny stand-in for the backend's `GET /api/v1/public/tenant-context`,
 * keyed by the incoming `Host` header exactly like the real handler
 * (`sanvi-backend`'s `public_tenant_context`). Started as Playwright's first
 * `webServer` entry (see `playwright.config.ts`) — deliberately plain `.mjs`,
 * not `.ts`, because it has to run as a raw `node` CLI command with no build
 * step, on whatever Node version CI happens to pin.
 *
 * Playwright starts `webServer` entries and waits for each one's own `url`
 * to answer before moving on to the next entry, then to tests — it does
 * *not* run `globalSetup` before `webServer` (verified empirically: a
 * `globalSetup` that starts this same mock never got a chance to run before
 * the storefront's own `webServer` entry exhausted its 60s readiness
 * timeout, since `hooks.server.ts` 500s on every request without a backend
 * to resolve tenants against). A second `webServer` entry, not
 * `globalSetup`, is what actually gets this backend up first.
 *
 * Host keys must match the preview server's actual `host:port` — see
 * `playwright.config.ts`'s `use.baseURL` / the storefront `webServer` entry
 * (port 4174) and `tenancy.spec.ts`'s `*.localhost` navigations.
 * `*.localhost` resolves to loopback without any `/etc/hosts` entry
 * (RFC 6761) — that's what makes driving three different "hosts" against
 * one local server possible. (Playwright/Chromium refuses to let a test
 * override the `Host` header directly — verified:
 * `page.setExtraHTTPHeaders({ Host: ... })` throws `net::ERR_INVALID_ARGUMENT`.)
 */
import { createServer } from 'node:http'

const PORT = 8080

const TENANTS = {
  'localhost:4174': {
    tenant_id: '11111111-1111-1111-1111-111111111111',
    slug: 'default',
    display_name: 'Default Tenant',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'acme.localhost:4174': {
    tenant_id: '22222222-2222-2222-2222-222222222222',
    slug: 'acme',
    display_name: 'Acme Corporation',
    status: 'active',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
  'suspended.localhost:4174': {
    tenant_id: '33333333-3333-3333-3333-333333333333',
    slug: 'suspended-co',
    display_name: 'Suspended Co',
    status: 'suspended',
    region: 'us',
    default_locale: 'en',
    resolution_source: 'subdomain',
  },
}

const server = createServer((req, res) => {
  if (req.url === '/__health') {
    res.writeHead(200)
    res.end('ok')
    return
  }

  if (req.url === '/api/v1/public/tenant-context') {
    const tenant = req.headers.host ? TENANTS[req.headers.host] : undefined
    if (!tenant) {
      res.writeHead(404, { 'content-type': 'application/problem+json' })
      res.end(
        JSON.stringify({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Unknown host',
        }),
      )
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(tenant))
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, () => {
  // biome-ignore lint/suspicious/noConsole: CI-visible confirmation that Playwright's first `webServer` entry actually came up.
  console.log(`[mock-api] listening on ${PORT}`)
})
