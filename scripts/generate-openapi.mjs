#!/usr/bin/env node
/**
 * Contract-first generation: pulls the merged OpenAPI document (paths +
 * `components/schemas`) straight from the backend's `sanvi-cli openapi`
 * command and emits typed bindings for `@sanvi/api-client`.
 *
 * The committed `sanvi-backend/api/{context}.yaml` files are paths-only
 * (see `sanvi-backend/apps/cli/src/openapi.rs`'s `write_specs`) — they exist
 * to catch path-set drift per bounded context, not to generate types from.
 * This script always talks to the backend's own CLI so `components/schemas`
 * (the part `openapi-typescript` actually needs) is never missing.
 *
 * Requires a sibling `sanvi-backend` checkout (override with
 * `SANVI_BACKEND_DIR`) and a working `cargo`. Run via `pnpm generate:api`.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_DIR = resolve(ROOT, process.env.SANVI_BACKEND_DIR ?? '../sanvi-backend')
const MERGED_SPEC_PATH = resolve(ROOT, 'packages/api-client/openapi/merged.json')
const GENERATED_TYPES_PATH = resolve(ROOT, 'packages/api-client/src/generated/types.ts')

const GENERATED_HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 * Produced by \`pnpm generate:api\` (\`scripts/generate-openapi.mjs\`) from
 * \`sanvi-cli openapi\`'s merged document. Regenerate after any backend
 * contract change; CI's \`api-types-drift\` job fails on staleness.
 */
`

function runBackendCli() {
  console.log(`Running \`cargo run -p sanvi-cli -- openapi\` in ${BACKEND_DIR} ...`)
  const stdout = execFileSync('cargo', ['run', '-p', 'sanvi-cli', '--quiet', '--', 'openapi'], {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(stdout)
}

async function main() {
  const merged = runBackendCli()

  mkdirSync(dirname(MERGED_SPEC_PATH), { recursive: true })
  writeFileSync(MERGED_SPEC_PATH, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Wrote ${MERGED_SPEC_PATH}`)

  const ast = await openapiTS(merged)
  const types = astToString(ast)

  mkdirSync(dirname(GENERATED_TYPES_PATH), { recursive: true })
  writeFileSync(GENERATED_TYPES_PATH, GENERATED_HEADER + types)
  console.log(`Wrote ${GENERATED_TYPES_PATH}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
