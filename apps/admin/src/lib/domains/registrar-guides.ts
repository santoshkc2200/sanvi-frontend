import { cloudflareGuide } from './guides/cloudflare'
import { genericGuide } from './guides/generic'
import { godaddyGuide } from './guides/godaddy'
import { onamaeGuide } from './guides/onamae'
import { route53Guide } from './guides/route53'
import { valueDomainGuide } from './guides/value-domain'

export type RegistrarId =
  | 'cloudflare'
  | 'route53'
  | 'godaddy'
  | 'value_domain'
  | 'namecheap'
  | 'google_domains'
  | 'onamae_jp'
  | 'generic'

export interface GuideStep {
  textKey: string
  screenshot?: string
}

export interface RegistrarGuide {
  id: RegistrarId
  nameKey: string
  steps: GuideStep[]
}

export const REGISTRAR_GUIDES: Record<RegistrarId, RegistrarGuide> = {
  cloudflare: cloudflareGuide,
  route53: route53Guide,
  godaddy: godaddyGuide,
  value_domain: valueDomainGuide,
  onamae_jp: onamaeGuide,
  generic: genericGuide,
  namecheap: {
    id: 'namecheap',
    nameKey: 'admin.domains.guides.generic.name',
    steps: genericGuide.steps,
  },
  google_domains: {
    id: 'google_domains',
    nameKey: 'admin.domains.guides.generic.name',
    steps: genericGuide.steps,
  },
}

export const ALL_GUIDES: RegistrarGuide[] = [
  cloudflareGuide,
  route53Guide,
  godaddyGuide,
  valueDomainGuide,
  onamaeGuide,
  genericGuide,
]

export function detectRegistrar(source?: string[] | string | null): RegistrarId | 'unknown' {
  if (!source) return 'unknown'

  if (typeof source === 'string') {
    const s = source.trim().toLowerCase()
    if (s === 'cloudflare') return 'cloudflare'
    if (s === 'route53' || s === 'route_53' || s === 'aws') return 'route53'
    if (s === 'godaddy') return 'godaddy'
    if (s === 'value_domain' || s === 'valuedomain' || s === 'value-domain') return 'value_domain'
    if (s === 'namecheap') return 'namecheap'
    if (s === 'google_domains' || s === 'googledomains') return 'google_domains'
    if (s === 'onamae_jp' || s === 'onamae') return 'onamae_jp'
    if (s === 'generic') return 'generic'
    return 'unknown'
  }

  if (Array.isArray(source)) {
    if (source.length === 0) return 'unknown'
    const lower = source.map((ns) => ns.toLowerCase())
    const anyEnds = (suffix: string) => lower.some((ns) => ns.endsWith(suffix))
    const anyContains = (pattern: string) => lower.some((ns) => ns.includes(pattern))

    if (anyEnds('ns.cloudflare.com') || anyContains('cloudflare.com')) {
      return 'cloudflare'
    }
    if (anyContains('awsdns') || anyEnds('amazonaws.com')) {
      return 'route53'
    }
    if (anyEnds('domaincontrol.com')) {
      return 'godaddy'
    }
    if (anyEnds('value-domain.com') || anyContains('value-domain')) {
      return 'value_domain'
    }
    if (anyEnds('namecheaphosting.com') || anyEnds('registrar-servers.com')) {
      return 'namecheap'
    }
    if (anyEnds('googledomains.com')) {
      return 'google_domains'
    }
    if (anyEnds('gmo.jp') || anyEnds('onamae.com') || anyContains('onamae')) {
      return 'onamae_jp'
    }
    return 'unknown'
  }

  return 'unknown'
}

export function getGuide(
  registrarId: RegistrarId | 'unknown' | string | null | undefined,
): RegistrarGuide {
  if (!registrarId || registrarId === 'unknown') {
    return genericGuide
  }
  return REGISTRAR_GUIDES[registrarId as RegistrarId] ?? genericGuide
}
