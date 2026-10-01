import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseSurfaceFile, scanSurfaceLeaks, shardMarkers } from '../src/check-i18n-shards.mjs'

// Fixture surface modules live under __fixtures__/ as .txt: their whole
// purpose is to contain import-shaped text, which check:boundaries' regex
// scanner would otherwise read as real cross-package imports.
const FIXTURES = fileURLToPath(new URL('../__fixtures__/i18n-shards/', import.meta.url))
const fixture = (name: string) => readFileSync(`${FIXTURES}${name}`, 'utf8')

describe('check:i18n-shards gate', () => {
  describe('parseSurfaceFile', () => {
    it('extracts the en and ja shard sets from a surface module', () => {
      expect(parseSurfaceFile(fixture('marketing-surface.txt'))).toEqual({
        en: new Set(['common', 'errors']),
        ja: new Set(['common', 'errors']),
      })
    })

    it('treats a ja-only import as a mismatch the caller can flag', () => {
      const parsed = parseSurfaceFile(fixture('ja-only-import.txt'))
      expect(parsed.en.size).toBe(0)
      expect(parsed.ja.has('auth')).toBe(true)
    })
  })

  describe('shardMarkers', () => {
    it('keeps only locale-safe values, longest first, capped', () => {
      const shard = {
        short: 'Ok',
        quoted: 'He said "hello" to everyone in the whole wide world',
        escaped: 'Back\\slash and a very long tail of text for measuring',
        a: 'This is a perfectly ordinary sentence of decent length.',
        b: 'Another perfectly ordinary sentence, also of some length.',
        c: 'A third ordinary sentence that is easily long enough here.',
        d: 'A fourth ordinary sentence, plenty long, no odd characters.',
        e: 'A fifth ordinary sentence that is also long enough to use.',
      }
      const markers = shardMarkers(shard, { foreign: true })
      expect(markers).not.toContain(shard['quoted'])
      expect(markers).not.toContain(shard['escaped'])
      expect(markers).not.toContain(shard['short'])
      expect(markers.length).toBeLessThanOrEqual(5)
      // Longest-first ordering.
      expect(markers[0]?.length).toBeGreaterThanOrEqual(markers[1]?.length ?? 0)
    })

    it('uses a lower length bar for own-shard presence', () => {
      const shard = { retry: 'Try again' }
      expect(shardMarkers(shard, { foreign: true })).toEqual([])
      expect(shardMarkers(shard, { foreign: false })).toEqual(['Try again'])
    })
  })

  describe('scanSurfaceLeaks', () => {
    const shardValues = new Map<string, { en: Record<string, string>; ja: Record<string, string> }>(
      [
        [
          'common',
          {
            en: {
              'common.retry': 'Try again',
              'common.boot.failureMessage': 'Could not reach the server, please retry now.',
            },
            ja: {
              'common.retry': '再試行',
              'common.boot.failureMessage':
                'サーバーに接続できませんでした。今すぐ再試行してください。',
            },
          },
        ],
        [
          'admin',
          {
            en: { 'admin.title': 'Manage the advertising budget for this campaign carefully.' },
            ja: { 'admin.title': 'このキャンペーンの広告予算を慎重に管理してください。' },
          },
        ],
      ],
    )

    it('passes when only own-surface shards are present', () => {
      const result = scanSurfaceLeaks({
        files: [
          {
            path: 'chunk-a.js',
            content:
              'export default {"common.retry":"Try again"}; // サーバーに接続できませんでした。今すぐ再試行してください。',
          },
        ],
        surfaceShards: new Set(['common']),
        shardValues,
      })
      expect(result.ok).toBe(true)
      expect(result.foreignHits).toEqual([])
      expect(result.missingOwn).toEqual([])
    })

    it('fails when a foreign shard value leaks into the build', () => {
      const result = scanSurfaceLeaks({
        files: [
          {
            path: 'chunk-b.js',
            content:
              'export default {"admin.title":"Manage the advertising budget for this campaign carefully."}',
          },
        ],
        surfaceShards: new Set(['common']),
        shardValues,
      })
      expect(result.ok).toBe(false)
      expect(result.foreignHits).toHaveLength(1)
      expect(result.foreignHits[0]?.shard).toBe('admin')
      expect(result.foreignHits[0]?.locale).toBe('en')
      expect(result.foreignHits[0]?.file).toBe('chunk-b.js')
    })

    it('fails when an own shard is entirely absent — the gate cannot pass vacuously', () => {
      const result = scanSurfaceLeaks({
        files: [{ path: 'chunk-a.js', content: 'export default {}' }],
        surfaceShards: new Set(['common']),
        shardValues,
      })
      expect(result.ok).toBe(false)
      expect(result.missingOwn).toContain('common (en)')
    })

    it('catches a ja lazy-chunk leak, not just initial en shards', () => {
      const result = scanSurfaceLeaks({
        files: [
          {
            path: 'lazy-ja.js',
            content: 'サーバーに接続できませんでした。今すぐ再試行してください。',
          },
        ],
        surfaceShards: new Set(['admin']),
        shardValues,
      })
      expect(result.ok).toBe(false)
      expect(result.foreignHits[0]?.shard).toBe('common')
      expect(result.foreignHits[0]?.locale).toBe('ja')
    })

    it('never uses a value shared between shards as a leak marker', () => {
      const duplicated = 'This exact sentence exists in two different shards.'
      const shards = new Map<string, { en: Record<string, string>; ja: Record<string, string> }>([
        [
          'storefront',
          {
            en: {
              'storefront.a': duplicated,
              'storefront.b': 'A unique storefront-only sentence for markers.',
            },
            ja: {},
          },
        ],
        [
          'admin',
          {
            en: { 'admin.a': duplicated, 'admin.b': 'A unique admin-only sentence for the scan.' },
            ja: {},
          },
        ],
      ])
      // The storefront ships the duplicated sentence — via its own shard.
      // Attributing it to the admin shard would be a false positive.
      const result = scanSurfaceLeaks({
        files: [{ path: 'chunk.js', content: duplicated }],
        surfaceShards: new Set(['storefront']),
        shardValues: shards,
      })
      expect(result.foreignHits).toEqual([])
    })
  })
})
