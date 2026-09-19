import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

/**
 * Source-map custody (FR-1104, NFR-1104): builds emit their `.map` files into
 * a **private** staging directory instead of the public output, with a
 * manifest pairing each bundle to its map so a private upload (the vendor is
 * a needs-humans item) has everything it needs.
 *
 * The failure this exists to prevent is the bundler default: maps generated
 * into the served directory. "Uploaded *and* served" is the posture most
 * integrations drift into; `scripts/check-sourcemaps-not-served.mjs` is the
 * gate that catches it, and this plugin is what keeps the passing builds
 * passing — the maps are real (stack traces are symbolicable) but they were
 * never in the public output for even one build.
 *
 * Mechanism: with `build.sourcemap: 'hidden'` rollup emits each map as a
 * bundle asset. In `generateBundle` — before anything touches disk — the map
 * assets are removed from the bundle and staged in memory; `writeBundle`
 * then writes them under the private dir. SvelteKit's adapter copies
 * whatever the client build wrote, so a map that never entered the bundle
 * also never reaches `build/client`.
 */

export interface PrivateSourceMapsPluginOptions {
  /**
   * Where staged maps live. Must sit outside every served directory — the
   * default is a sibling of the app root, `sourcemaps-private/`, which is
   * gitignored and never referenced by any server config.
   */
  privateDir?: string
}

interface MinimalOutputOptions {
  dir?: string
}

interface MinimalBundleAsset {
  type: 'asset'
  fileName: string
  source: string | Uint8Array
}

interface MinimalBundleChunk {
  type: 'chunk'
  fileName: string
  sourcemap?: unknown
}

type MinimalBundleEntry = MinimalBundleAsset | MinimalBundleChunk

type MinimalBundle = Record<string, MinimalBundleEntry>

interface StagedMap {
  /** Path under the private dir, namespaced per output dir (`client/…`, `server/…`). */
  stagedPath: string
  content: string
}

export function privateSourceMapsPlugin(options: PrivateSourceMapsPluginOptions = {}): {
  name: string
  apply: 'build'
  enforce: 'post'
  generateBundle: (options: MinimalOutputOptions, bundle: MinimalBundle) => void
  writeBundle: () => Promise<void>
} {
  const staged: StagedMap[] = []

  return {
    name: 'sanvi-private-sourcemaps',
    apply: 'build',
    enforce: 'post',
    generateBundle(outputOptions, bundle) {
      // SvelteKit builds client and server in one invocation; both write
      // `.map` siblings with independent hash namespaces, but the staging
      // path is namespaced by output dir name anyway so a collision is
      // structurally impossible rather than merely unlikely.
      const namespace = outputOptions.dir ? basename(outputOptions.dir) : ''
      const stagedFromAssets = new Set<string>()

      // Path 1: rollup emits each map as a bundle asset — remove it from the
      // bundle so it is never written.
      for (const [fileName, entry] of Object.entries(bundle)) {
        if (!fileName.endsWith('.map')) continue
        if (entry.type !== 'asset' || entry.source === undefined) continue
        const content =
          typeof entry.source === 'string'
            ? entry.source
            : Buffer.from(entry.source).toString('utf8')
        staged.push({ stagedPath: namespace ? join(namespace, fileName) : fileName, content })
        stagedFromAssets.add(fileName)
        delete bundle[fileName]
      }

      // Path 2: the map rides on the chunk object instead of a bundle asset.
      // Nulling it stops rollup from serializing the file; with `hidden`
      // there is no sourceMappingURL comment left pointing at anything.
      for (const entry of Object.values(bundle)) {
        if (entry.type !== 'chunk' || !entry.sourcemap) continue
        const mapFileName = `${entry.fileName}.map`
        if (stagedFromAssets.has(mapFileName)) continue
        staged.push({
          stagedPath: namespace ? join(namespace, mapFileName) : mapFileName,
          content: JSON.stringify(entry.sourcemap),
        })
        entry.sourcemap = undefined
      }
    },
    async writeBundle() {
      if (staged.length === 0) return
      const privateDir = options.privateDir ?? 'sourcemaps-private'
      const pending = [...staged]
      staged.length = 0
      await mkdir(privateDir, { recursive: true })
      const manifest: Record<string, string> = {}
      for (const map of pending) {
        const target = join(privateDir, map.stagedPath)
        await mkdir(join(target, '..'), { recursive: true })
        await writeFile(target, map.content)
        manifest[map.stagedPath] = 'staged'
      }
      await writeFile(
        join(privateDir, 'manifest.json'),
        JSON.stringify(
          { stagedAt: new Date().toISOString(), maps: Object.keys(manifest) },
          null,
          2,
        ),
      )
    },
  }
}
