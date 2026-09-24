import { describe, expect, it } from 'vitest'
import {
  buildSecurityHeaders,
  isLocalhostHost,
  securityHeadersRecord,
} from '../src/security-headers.ts'

/**
 * These values are the backend's specified header set (NFR-1114), mirrored
 * from `sanvi-backend` `crates/platform/http/src/middleware.rs`'s
 * `SecurityHeaders` layer. Asserted with exact equality so removing a
 * header — or quietly changing a value — fails here before it ships.
 */
describe('buildSecurityHeaders', () => {
  it('emits the exact specified set without HSTS', () => {
    expect(buildSecurityHeaders()).toEqual({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'x-frame-options': 'DENY',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    })
  })

  it('adds HSTS only when asked', () => {
    expect(buildSecurityHeaders({ hsts: true })).toEqual({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'x-frame-options': 'DENY',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
    })
  })

  it('every declared header is present in the default build — a removal is a failure', () => {
    const headers = buildSecurityHeaders({ hsts: true })
    for (const name of [
      'x-content-type-options',
      'referrer-policy',
      'x-frame-options',
      'permissions-policy',
      'strict-transport-security',
    ]) {
      expect(headers, name).toHaveProperty(name)
    }
  })

  it('flattens to a plain record for Vite server/preview header config', () => {
    const record = securityHeadersRecord({ hsts: true })
    expect(record['x-frame-options']).toBe('DENY')
    expect(Object.keys(record)).toHaveLength(5)
  })
})

describe('isLocalhostHost', () => {
  it.each([
    ['localhost', true],
    ['localhost:5173', true],
    ['127.0.0.1:4175', true],
    ['[::1]:5173', true],
    ['storefront.sanvi.app', false],
    ['tenant.example.com:443', false],
    [undefined, false],
    [null, false],
    ['', false],
  ])('%s → %s', (host, expected) => {
    expect(isLocalhostHost(host)).toBe(expected)
  })
})
