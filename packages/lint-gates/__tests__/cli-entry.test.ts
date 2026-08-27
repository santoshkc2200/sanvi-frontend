import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

// pnpm's bin shims exec the *symlink* under node_modules/.bin while
// `import.meta.url` inside the module resolves to the realpath. These tests
// invoke every gate through a symlink so a regression in the entry-point
// guard (main() silently skipped, exit 0) fails here instead of shipping as
// a no-op gate.
const tmp = mkdtempSync(join(tmpdir(), 'sanvi-gate-bins-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

function runThroughSymlink(scriptName: string, args: string[]) {
  const symlinkPath = join(tmp, scriptName)
  rmSync(symlinkPath, { force: true })
  symlinkSync(join(SRC, scriptName), symlinkPath)
  return spawnSync(process.execPath, [symlinkPath, ...args], { encoding: 'utf8' })
}

describe('gate CLI entry points (pnpm bin conditions)', () => {
  it('check-i18n fails on the violation fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-i18n.mjs', [`${FIXTURES}i18n-violation`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('hardcoded string')
  })

  it('check-i18n passes on the clean fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-i18n.mjs', [`${FIXTURES}i18n-clean`])
    expect(result.status).toBe(0)
  })

  it('check-tokens fails on the violation fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-tokens.mjs', [`${FIXTURES}tokens-violation`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('raw value')
  })

  it('check-tokens passes on the clean fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-tokens.mjs', [`${FIXTURES}tokens-clean`])
    expect(result.status).toBe(0)
  })

  it('check-boundaries fails on the violation fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-boundaries.mjs', [`${FIXTURES}boundaries-violation`])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('violation')
  })

  it('check-boundaries passes on the clean fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-boundaries.mjs', [`${FIXTURES}boundaries-clean`])
    expect(result.status).toBe(0)
  })

  it('check-budget fails on the violation fixture through a symlinked bin', () => {
    const result = runThroughSymlink('check-budget.mjs', [
      '--dir',
      `${FIXTURES}budget-violation`,
      '--chunk-kb',
      '1',
    ])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('over the 1 KB budget')
  })
})
