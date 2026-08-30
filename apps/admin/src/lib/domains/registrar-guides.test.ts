import { describe, expect, it } from 'vitest'
import { ALL_GUIDES, detectRegistrar, getGuide, REGISTRAR_GUIDES } from './registrar-guides'

describe('registrar-guides catalog and detection', () => {
  describe('detectRegistrar', () => {
    it('detects from backend registrar string identifier', () => {
      expect(detectRegistrar('cloudflare')).toBe('cloudflare')
      expect(detectRegistrar('route53')).toBe('route53')
      expect(detectRegistrar('godaddy')).toBe('godaddy')
      expect(detectRegistrar('value_domain')).toBe('value_domain')
      expect(detectRegistrar('namecheap')).toBe('namecheap')
      expect(detectRegistrar('google_domains')).toBe('google_domains')
      expect(detectRegistrar('onamae_jp')).toBe('onamae_jp')
      expect(detectRegistrar('generic')).toBe('generic')
      expect(detectRegistrar('some_unknown_provider')).toBe('unknown')
      expect(detectRegistrar(null)).toBe('unknown')
      expect(detectRegistrar(undefined)).toBe('unknown')
      expect(detectRegistrar('')).toBe('unknown')
    })

    it('detects from NS record hostnames', () => {
      expect(detectRegistrar(['ada.ns.cloudflare.com', 'bob.ns.cloudflare.com'])).toBe('cloudflare')
      expect(detectRegistrar(['ns-42.awsdns-05.com', 'ns-100.awsdns-12.org'])).toBe('route53')
      expect(detectRegistrar(['pdns05.domaincontrol.com'])).toBe('godaddy')
      expect(detectRegistrar(['ns1.value-domain.com'])).toBe('value_domain')
      expect(detectRegistrar(['dns1.namecheaphosting.com'])).toBe('namecheap')
      expect(detectRegistrar(['ns1.googledomains.com'])).toBe('google_domains')
      expect(detectRegistrar(['dns1.onamae.com'])).toBe('onamae_jp')
      expect(detectRegistrar(['ns1.customdns.org', 'ns2.customdns.org'])).toBe('unknown')
      expect(detectRegistrar([])).toBe('unknown')
    })
  })

  describe('getGuide', () => {
    it('returns specific guide for known registrar ids', () => {
      expect(getGuide('cloudflare').id).toBe('cloudflare')
      expect(getGuide('cloudflare').nameKey).toBe('admin.domains.guides.cloudflare.name')
      expect(getGuide('cloudflare').steps.length).toBeGreaterThan(0)

      expect(getGuide('route53').id).toBe('route53')
      expect(getGuide('route53').nameKey).toBe('admin.domains.guides.route53.name')
      expect(getGuide('route53').steps.length).toBeGreaterThan(0)

      expect(getGuide('godaddy').id).toBe('godaddy')
      expect(getGuide('godaddy').nameKey).toBe('admin.domains.guides.godaddy.name')
      expect(getGuide('godaddy').steps.length).toBeGreaterThan(0)

      expect(getGuide('value_domain').id).toBe('value_domain')
      expect(getGuide('value_domain').nameKey).toBe('admin.domains.guides.valueDomain.name')
      expect(getGuide('value_domain').steps.length).toBeGreaterThan(0)

      expect(getGuide('onamae_jp').id).toBe('onamae_jp')
      expect(getGuide('onamae_jp').nameKey).toBe('admin.domains.guides.onamae.name')
      expect(getGuide('onamae_jp').steps.length).toBe(4)

      expect(REGISTRAR_GUIDES.cloudflare.id).toBe('cloudflare')
      expect(REGISTRAR_GUIDES.onamae_jp.id).toBe('onamae_jp')
    })

    it('falls back to generic guide for unknown or invalid ids', () => {
      const generic = getGuide('unknown')
      expect(generic.id).toBe('generic')
      expect(generic.nameKey).toBe('admin.domains.guides.generic.name')
      expect(generic.steps.length).toBeGreaterThan(0)

      expect(getGuide(null).id).toBe('generic')
      expect(getGuide(undefined).id).toBe('generic')
      expect(getGuide('non_existent').id).toBe('generic')
    })

    it('exports all guides list with expected guide instances', () => {
      expect(ALL_GUIDES.length).toBe(6)
      expect(ALL_GUIDES.map((g) => g.id)).toEqual([
        'cloudflare',
        'route53',
        'godaddy',
        'value_domain',
        'onamae_jp',
        'generic',
      ])
    })
  })
})
