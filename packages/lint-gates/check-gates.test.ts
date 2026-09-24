import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { scanWorkspace } from './src/check-csp.mjs'
import { scanWorkspace as scanStorage } from './src/check-storage-surface.mjs'
import { scanWorkspace as scanRuntimeCode } from './src/check-runtime-code-sources.mjs'

/**
 * TASK-024's gate proofs: each scanner catches a planted violation (a gate
 * that has never caught anything is a gate nobody has tested) and passes a
 * clean tree.
 */

function makeWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'sanvi-gate-fixture-'))
}

let workspace: string

afterAll(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true })
})

describe('check:csp scanner', () => {
  it('catches a policy source outside packages/csp', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'apps/admin/src'), { recursive: true })
    writeFileSync(
      join(workspace, 'apps/admin/src/rogue.ts'),
      "export const policy = \"script-src 'self' 'unsafe-inline'\"\n",
    )
    const violations = scanWorkspace(workspace)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ file: 'apps/admin/src/rogue.ts', token: 'unsafe-inline' })
  })

  it('passes a clean tree and exempts packages/csp, tests, and dot-directory artifacts', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'packages/csp/src'), { recursive: true })
    mkdirSync(join(workspace, 'apps/admin/__tests__'), { recursive: true })
    mkdirSync(join(workspace, 'apps/admin/.lighthouseci'), { recursive: true })
    writeFileSync(
      join(workspace, 'packages/csp/src/index.ts'),
      "export const p = \"style-src 'self' 'unsafe-inline'\"\n",
    )
    writeFileSync(
      join(workspace, 'apps/admin/__tests__/csp.test.ts'),
      "expect(policy).not.toContain('unsafe-inline')\n",
    )
    writeFileSync(
      join(workspace, 'apps/admin/.lighthouseci/report.html'),
      '<meta content="script-src \'unsafe-inline\'">\n',
    )
    expect(scanWorkspace(workspace)).toEqual([])
  })

  it('honours the trailing dev-only marker on the offending line', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'apps/storefront'), { recursive: true })
    writeFileSync(
      join(workspace, 'apps/storefront/svelte.config.js'),
      'list.push("\'unsafe-inline\'") // sanvi-csp: dev-only\n',
    )
    expect(scanWorkspace(workspace)).toEqual([])
  })
})

describe('check:storage-surface scanner', () => {
  it('catches an unreviewed storage access', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'apps/admin/src'), { recursive: true })
    writeFileSync(
      join(workspace, 'apps/admin/src/leaky.ts'),
      "export const stash = (v: string) => localStorage.setItem('thing', v)\n",
    )
    const violations = scanStorage(workspace)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.file).toBe('apps/admin/src/leaky.ts')
  })

  it('passes accesses in files on the reviewed list', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'packages/i18n/src'), { recursive: true })
    writeFileSync(
      join(workspace, 'packages/i18n/src/runtime.svelte.ts'),
      'document.cookie = `sanvi_locale=ja; samesite=lax`\n',
    )
    expect(scanStorage(workspace)).toEqual([])
  })
})

describe('check:runtime-code-sources scanner', () => {
  it('catches planted dynamic code loading', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'packages/ui/src'), { recursive: true })
    writeFileSync(
      join(workspace, 'packages/ui/src/loader.ts'),
      "export const boot = (src: string) => { const s = document.createElement('script'); s.src = src }\n",
    )
    const violations = scanRuntimeCode(workspace)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.file).toBe('packages/ui/src/loader.ts')
  })

  it('passes a package on the reviewed allow-list', () => {
    workspace = makeWorkspace()
    mkdirSync(join(workspace, 'packages/consent/src'), { recursive: true })
    writeFileSync(
      join(workspace, 'packages/consent/src/loader.ts'),
      "const el = doc.createElement('script')\n",
    )
    expect(scanRuntimeCode(workspace)).toEqual([])
  })
})
