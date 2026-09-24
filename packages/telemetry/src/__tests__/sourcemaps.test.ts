import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { privateSourceMapsPlugin } from '../node/sourcemaps'

const cleanup: string[] = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempPrivateDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sanvi-sourcemaps-'))
  cleanup.push(dir)
  return dir
}

/** The asset-shaped map `build.sourcemap: 'hidden'` makes rollup emit. */
function assetBundle(
  mapName: string,
): Record<string, { type: 'asset'; fileName: string; source: string }> {
  return { [mapName]: { type: 'asset', fileName: mapName, source: '{"version":3,"file":"x.js"}' } }
}

/** The chunk-shaped map some pipelines attach to the chunk object instead. */
function chunkBundle(
  chunkName: string,
): Record<string, { type: 'chunk'; fileName: string; sourcemap: unknown }> {
  return { [chunkName]: { type: 'chunk', fileName: chunkName, sourcemap: { version: 3 } } }
}

describe('privateSourceMapsPlugin', () => {
  it('never leaves a staged map in the bundle', () => {
    const plugin = privateSourceMapsPlugin()
    const bundle = assetBundle('entry.abc.js.map')

    plugin.generateBundle({ dir: 'dist' }, bundle)

    expect(bundle).toEqual({})
  })

  it('a later batch cannot evict earlier batches from the manifest — the client and server builds get separate plugin instances, so the last writeBundle would otherwise replace the manifest with only its own maps', async () => {
    const privateDir = await tempPrivateDir()

    // The client build: its instance flushes and writes the manifest.
    const clientPlugin = privateSourceMapsPlugin({ privateDir })
    clientPlugin.generateBundle({ dir: '/app/build/client' }, assetBundle('entry.abc.js.map'))
    await clientPlugin.writeBundle()
    // The server build: a different instance, last writer of the manifest.
    const serverPlugin = privateSourceMapsPlugin({ privateDir })
    serverPlugin.generateBundle({ dir: '/app/build/server' }, chunkBundle('index.js'))
    await serverPlugin.writeBundle()

    const manifest = JSON.parse(await readFile(join(privateDir, 'manifest.json'), 'utf8')) as {
      maps: string[]
    }
    expect(manifest.maps).toContain('client/entry.abc.js.map')
    expect(manifest.maps).toContain('server/index.js.map')

    // And both maps are actually on disk where the manifest points.
    expect(await readFile(join(privateDir, 'client/entry.abc.js.map'), 'utf8')).toContain(
      '"version"',
    )
    const staged = await readdir(join(privateDir, 'server'))
    expect(staged).toContain('index.js.map')
  })

  it('one instance flushing twice keeps the union too (shared-instance builds)', async () => {
    const privateDir = await tempPrivateDir()
    const plugin = privateSourceMapsPlugin({ privateDir })

    plugin.generateBundle({ dir: '/app/build/client' }, assetBundle('entry.abc.js.map'))
    await plugin.writeBundle()
    plugin.generateBundle({ dir: '/app/build/server' }, chunkBundle('index.js'))
    await plugin.writeBundle()

    const manifest = JSON.parse(await readFile(join(privateDir, 'manifest.json'), 'utf8')) as {
      maps: string[]
    }
    expect(manifest.maps).toEqual(['client/entry.abc.js.map', 'server/index.js.map'])
  })
})
