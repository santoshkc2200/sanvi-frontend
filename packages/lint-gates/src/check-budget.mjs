#!/usr/bin/env node
/**
 * Enforces the JS bundle budgets from `docs/architecture-overview.md` §6:
 *
 *   | Surface                        | Budget            |
 *   |---------------------------------|-------------------|
 *   | Storefront initial JS (gzip)    | ≤ 100 KB          |
 *   | Admin initial JS (gzip)         | ≤ 250 KB          |
 *   | Any single route chunk          | ≤ 50 KB           |
 *
 * The per-chunk budget is enforced unconditionally — every `.js` file in
 * the build output is gzipped and checked, regardless of app shape.
 *
 * The *initial* budget is precise for SvelteKit's `adapter-node` output
 * (`_app/immutable/entry/` + `_app/immutable/chunks/`, summed and checked
 * — `_app/immutable/nodes/` is per-route code, excluded). For a Vite SPA
 * build there's no such directory convention to key off without reading a
 * `manifest.json` this script doesn't generate, so the total is reported
 * for visibility but not hard-enforced — tightening that is a follow-up
 * once each SPA's real route count makes a manifest-based check worth it.
 */
import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { isDirectory, isMainEntryPoint, walkFiles } from './walk-files.mjs'

function gzipSizeKb(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content).length / 1024
}

function parseArgs(argv) {
  const args = { dir: undefined, initialKb: 100, chunkKb: 50 }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') args.dir = argv[++i]
    else if (argv[i] === '--initial-kb') args.initialKb = Number(argv[++i])
    else if (argv[i] === '--chunk-kb') args.chunkKb = Number(argv[++i])
  }
  return args
}

function isSvelteKitClientOutput(dir) {
  return isDirectory(join(dir, '_app', 'immutable'))
}

/**
 * @param {{ dir: string, initialKb: number, chunkKb: number }} args
 * @returns {{
 *   ok: boolean,
 *   skipped: boolean,
 *   message?: string,
 *   dir?: string,
 *   totalKb: number,
 *   initialKbTotal: number | null,
 *   initialKb: number,
 *   chunkKb: number,
 *   oversizedChunks: { file: string, kb: number }[],
 *   svelteKit: boolean,
 * }}
 */
export function runBudgetCheck({ dir, initialKb, chunkKb }) {
  if (!isDirectory(dir)) {
    return {
      ok: true,
      skipped: true,
      message: `(skipped — ${dir} does not exist; run \`build\` first)`,
      totalKb: 0,
      initialKbTotal: null,
      initialKb,
      chunkKb,
      oversizedChunks: [],
      svelteKit: false,
    }
  }

  const jsFiles = [...walkFiles(dir, (name) => name.endsWith('.js'))]
  const sizes = jsFiles.map((file) => ({ file, kb: gzipSizeKb(file) }))

  const oversizedChunks = sizes.filter((s) => s.kb > chunkKb)

  const svelteKit = isSvelteKitClientOutput(dir)
  let initialKbTotal = null
  if (svelteKit) {
    initialKbTotal = sizes
      .filter((s) => {
        const parts = s.file.split(sep)
        const immutableIndex = parts.indexOf('immutable')
        const bucket = immutableIndex === -1 ? undefined : parts[immutableIndex + 1]
        return bucket === 'entry' || bucket === 'chunks'
      })
      .reduce((sum, s) => sum + s.kb, 0)
  }

  const totalKb = sizes.reduce((sum, s) => sum + s.kb, 0)
  const initialOverBudget = initialKbTotal !== null && initialKbTotal > initialKb

  return {
    ok: oversizedChunks.length === 0 && !initialOverBudget,
    skipped: false,
    dir,
    totalKb,
    initialKbTotal,
    initialKb,
    chunkKb,
    oversizedChunks,
    svelteKit,
  }
}

function formatReport(result) {
  if (result.skipped) return result.message

  const lines = [`Build output: ${result.dir}`, `Total JS (gzip): ${result.totalKb.toFixed(1)} KB`]

  if (result.initialKbTotal !== null) {
    const status = result.initialKbTotal > result.initialKb ? '✗' : '✓'
    lines.push(
      `${status} Initial JS (entry+chunks, gzip): ${result.initialKbTotal.toFixed(1)} KB / ${result.initialKb} KB budget`,
    )
  } else {
    lines.push(
      `  Initial JS: not measured for this build shape (no _app/immutable convention) — total reported above for visibility only.`,
    )
  }

  if (result.oversizedChunks.length > 0) {
    lines.push(`✗ ${result.oversizedChunks.length} chunk(s) over the ${result.chunkKb} KB budget:`)
    for (const chunk of result.oversizedChunks) {
      lines.push(`    ${chunk.file}: ${chunk.kb.toFixed(1)} KB`)
    }
  } else {
    lines.push(`✓ Every chunk is under the ${result.chunkKb} KB budget`)
  }

  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dir) {
    console.error(
      'Usage: sanvi-check-budget --dir <build-output-dir> [--initial-kb N] [--chunk-kb N]',
    )
    process.exit(2)
  }

  const result = runBudgetCheck(args)
  console.log(formatReport(result))

  if (!result.ok && !result.skipped) process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
