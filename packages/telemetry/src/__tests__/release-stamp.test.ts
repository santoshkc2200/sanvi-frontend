import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveReleaseStamp } from '../node/release-stamp'

// The app whose package.json supplies the version — this package itself.
const APP_DIR = join(import.meta.dirname, '..', '..')

describe('resolveReleaseStamp', () => {
  it('environment overrides pin every field — this is how builds and e2e fixtures agree', () => {
    const stamp = resolveReleaseStamp({
      appDir: APP_DIR,
      env: {
        SANVI_GIT_COMMIT: 'fix3d1a',
        SANVI_BUILT_AT: '2026-01-01T00:00:00Z',
        SANVI_ENVIRONMENT: 'staging',
      },
    })
    expect(stamp).toEqual({
      commit: 'fix3d1a',
      version: '0.1.0',
      built_at: '2026-01-01T00:00:00Z',
      environment: 'staging',
    })
  })

  it('defaults: commit from git, version from the app package, RFC 3339 built_at, local environment', () => {
    const stamp = resolveReleaseStamp({ appDir: APP_DIR })
    const expectedSha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: APP_DIR,
      encoding: 'utf8',
    }).trim()

    expect(stamp.commit).toBe(expectedSha)
    expect(stamp.version).toBe('0.1.0')
    expect(stamp.environment).toBe('local')
    expect(stamp.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
  })

  it('carries exactly the four contract fields — nothing tenant-scoped can ride along', () => {
    const stamp = resolveReleaseStamp({ appDir: APP_DIR })
    expect(Object.keys(stamp).sort()).toEqual(['built_at', 'commit', 'environment', 'version'])
  })
})
