import { describe, expect, it } from 'vitest'
import { sanitizeSegmentation, scrubText, scrubUrl } from '../scrub'

describe('scrubUrl', () => {
  it('strips the query string and fragment from an absolute URL', () => {
    expect(scrubUrl('https://cdn.example.test/fonts/jp.woff2?v=9&email=x@y.z#frag')).toBe(
      'https://cdn.example.test/fonts/jp.woff2',
    )
  })

  it('collapses a same-origin relative path to its pathname', () => {
    expect(scrubUrl('/products/blue-toy?utm_source=email', 'https://shop.example.test/home')).toBe(
      '/products/blue-toy',
    )
  })

  it('degrades unparseable input to the text before the first ? or #', () => {
    expect(scrubUrl('not a url?token=abc')).toBe('not a url')
  })

  it('keeps the pathname of any route-shaped string, query included or not', () => {
    expect(scrubUrl('/products/[id]')).toBe('/products/[id]')
    expect(scrubUrl('/search?q=user%40example.test')).toBe('/search')
  })
})

describe('sanitizeSegmentation', () => {
  it('scrubs the route and keeps well-formed fields', () => {
    expect(
      sanitizeSegmentation({
        route: '/search?q=secret',
        tenantId: '11111111-1111-1111-1111-111111111111',
        locale: 'ja',
        deviceClass: 'mobile',
        themeRevision: 4,
      }),
    ).toEqual({
      route: '/search',
      tenantId: '11111111-1111-1111-1111-111111111111',
      locale: 'ja',
      deviceClass: 'mobile',
      themeRevision: 4,
    })
  })

  it('demotes a non-opaque tenant id to null instead of forwarding it', () => {
    expect(
      sanitizeSegmentation({
        route: '/',
        tenantId: 'not-an-email@example.test',
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: null,
      }).tenantId,
    ).toBeNull()
  })

  it('demotes a missing theme revision to null, not zero', () => {
    expect(
      sanitizeSegmentation({
        route: '/',
        tenantId: null,
        locale: 'en',
        deviceClass: 'desktop',
        themeRevision: undefined as unknown as null,
      }).themeRevision,
    ).toBeNull()
  })
})

describe('scrubText (error payloads, breadcrumbs, log lines)', () => {
  it('removes email addresses', () => {
    expect(scrubText('failed for jane.doe@example.test during checkout')).toBe(
      'failed for [removed-email] during checkout',
    )
  })

  it('removes bearer tokens', () => {
    expect(scrubText('rejected: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(
      'rejected: [removed-token]',
    )
  })

  it('removes credential-shaped field assignments', () => {
    expect(scrubText('bad request: session_token=abc123def456')).toBe(
      'bad request: [removed-secret]',
    )
    expect(scrubText('api_key: "sk-live-abcdef123456" refused')).toBe('[removed-secret] refused')
  })

  it('caps length — a runaway stack is truncated, not forwarded whole', () => {
    expect(scrubText('x'.repeat(4096)).length).toBe(2048)
  })

  it('leaves clean text alone', () => {
    expect(scrubText('Cannot read properties of undefined (reading id)')).toBe(
      'Cannot read properties of undefined (reading id)',
    )
  })
})
