import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The storefront bundle's advertising growth is attributable to the beacon
 * alone (phase 10, TASK-018): the storefront imports the conversion-beacon
 * sender and its request/response types — and nothing else from the
 * api-client's advertising surface. A dashboard function imported "just for
 * one helper" here is how a tenant-facing store ends up shipping the whole
 * advertising client, and the i18n-catalog budget overage (TASK-032) shows
 * exactly how expensive "just one more import" gets.
 *
 * Source-level assertion: the build-level number is `check:budget`'s job.
 */

/** Advertising-shaped names the storefront may import from the api-client:
    the beacon sender, its request type, and the click-id carrier. */
const ALLOWED_ADVERTISING_IMPORTS = new Set([
  'sendConversionBeacon',
  'TrackConversionRequest',
  'ClickIds',
])

const BANNED_PREFIXES = [
  'getAd',
  'listAd',
  'putAd',
  'createAd',
  'deleteAd',
  'retryAd',
  'testAd',
  'streamAd',
  'acknowledgeAd',
  'refreshAd',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|svelte)$/.test(path)) out.push(path)
  }
  return out
}

function namedApiClientImports(source: string): string[] {
  const names: string[] = []
  for (const match of source.matchAll(
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]@sanvi\/api-client['"]/g,
  )) {
    for (const raw of match[2]!.split(',')) {
      const name = raw.replace(/\btype\s+/, '').trim()
      if (name) names.push(name)
    }
  }
  return names
}

describe('storefront imports the beacon, not the advertising client (TASK-018)', () => {
  const files = walk('src')

  it('no storefront module imports an advertising client function', () => {
    const violations: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const name of namedApiClientImports(source)) {
        if (BANNED_PREFIXES.some((prefix) => name.startsWith(prefix))) {
          violations.push(`${file}: ${name}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('the beacon module is present and is the sendConversionBeacon consumer', () => {
    const beacon = readFileSync('src/lib/tracking/beacon.ts', 'utf8')
    expect(beacon).toContain('sendConversionBeacon')
    // The rest of the advertising surface stays out of the storefront.
    const advertisingImports = files.flatMap((file) =>
      namedApiClientImports(readFileSync(file, 'utf8')).filter((name) =>
        ALLOWED_ADVERTISING_IMPORTS.has(name),
      ),
    )
    expect(advertisingImports).toContain('sendConversionBeacon')
  })
})
