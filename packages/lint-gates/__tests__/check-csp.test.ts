import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanWorkspace } from '../src/check-csp.mjs'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function scan(source: string, extension = 'ts') {
  const root = mkdtempSync(join(tmpdir(), 'sanvi-csp-'))
  roots.push(root)
  writeFileSync(join(root, `policy.${extension}`), source)
  return scanWorkspace(root)
}

describe('CSP comment and marker positions', () => {
  it('recognizes a trailing dev marker after a multiline comment', () => {
    expect(
      scan(`/* explanation
 * second line
 */
const source = "unsafe-inline" // sanvi-csp: dev-only
`),
    ).toEqual([])
  })

  it('reports the original line and cannot borrow a marker from another line', () => {
    expect(
      scan(`/* explanation
 * second line
 */
const source = "unsafe-inline"
// sanvi-csp: dev-only
`),
    ).toEqual([{ file: 'policy.ts', line: 4, token: 'unsafe-inline' }])
  })

  it('preserves line positions after multiline Svelte comments', () => {
    expect(
      scan(
        `<!-- explanation
second line -->
<script>
const source = "unsafe-eval"
</script>`,
        'svelte',
      ),
    ).toEqual([{ file: 'policy.svelte', line: 4, token: 'unsafe-eval' }])
  })
})
