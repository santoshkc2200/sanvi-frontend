#!/usr/bin/env node
/**
 * The two-numbers-never-one gate (phase 10, TASK-016, NFR-1002): fails on
 * any identifier that claims a single merged attribution figure — a
 * blended ROAS or conversion value. The advertising contract carries
 * `roas_platform` / `roas_sanvi` and `conversion_value` / `sanvi_revenue`
 * as separate, separately-labelled numbers; a field, variable, or key named
 * as their blend is how "a confident lie" ships as a tidy KPI.
 *
 * Word-bounded identifier matching over comment-stripped source, same
 * trade-off as `check-platform-literals.mjs`. Generated files are exempt
 * (contract data); the backend's own schema fields are the two *separate*
 * names, which this gate never lists — only blend-shaped names are banned.
 */
import { readFileSync } from 'node:fs'
import { extname, relative, sep } from 'node:path'
import { stripComments } from './check-platform-literals.mjs'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'

/**
 * Blend-shaped identifiers, snake_case and camelCase. snake_case forms
 * double as i18n-key suffixes and column keys; camelCase as variables and
 * props — both are places a blended number hides.
 */
const BLENDED_IDENTIFIERS = [
  'blended_roas',
  'blendedRoas',
  'roas_blended',
  'roasBlended',
  'total_roas',
  'totalRoas',
  'combined_roas',
  'combinedRoas',
  'average_roas',
  'averageRoas',
  'blended_revenue',
  'blendedRevenue',
  'blended_conversion_value',
  'blendedConversionValue',
  'blended_value',
  'blendedValue',
  'total_conversion_value',
  'totalConversionValue',
  'net_roas',
  'netRoas',
  'true_roas',
  'trueRoas',
  'overall_roas',
  'overallRoas',
]

export function scanFile(file, relativePath, source) {
  const isSvelte = extname(file) === '.svelte'
  const normalized = relativePath.split(sep).join('/')
  const violations = []

  if (normalized.includes('/generated/')) return violations

  const code = stripComments(source, isSvelte)
  for (const identifier of BLENDED_IDENTIFIERS) {
    const pattern = new RegExp(`\\b${identifier}\\b`, 'g')
    let match = pattern.exec(code)
    while (match !== null) {
      violations.push({
        file,
        line: lineOf(code, match.index),
        identifier,
      })
      match = pattern.exec(code)
    }
  }
  return violations
}

function lineOf(source, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') line += 1
  }
  return line
}

/** @returns {ReturnType<typeof scanFile>} */
export function scanWorkspace(root) {
  const violations = []
  const files = walkFiles(root, (name) => ['.ts', '.svelte'].includes(extname(name))).filter(
    (file) => {
      const rel = relative(root, file)
      return /^apps\/[^/]+\/(src|e2e)\//.test(rel) || /^packages\/[^/]+\/src\//.test(rel)
    },
  )
  for (const file of files) {
    const relativePath = relative(root, file)
    violations.push(...scanFile(file, relativePath, readFileSync(file, 'utf8')))
  }
  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-no-blended-attribution <workspace-root>')
    process.exit(2)
  }

  const violations = scanWorkspace(root)

  if (violations.length === 0) {
    console.log('✓ check:no-blended-attribution — two numbers, never one')
    return
  }

  console.error(`✗ check:no-blended-attribution — ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}  "${v.identifier}"\n` +
        `    platform-reported conversion value and Sanvi-observed revenue are separate,` +
        ` separately-labelled numbers — no blended ROAS or conversion value may exist`,
    )
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
