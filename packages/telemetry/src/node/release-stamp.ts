import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReleaseStamp } from '../types'

/**
 * Build-time release stamping (FR-1103): every app build embeds the same
 * identity `GET /api/v1/system/build` reports, so a measurement or an error
 * report can always name the exact build that produced it. Node-only —
 * imported by the apps' `vite.config.ts` files through the package's
 * `./release` entry, never from browser code.
 *
 * Environment overrides exist so a build pipeline (and the e2e fixture
 * standing in for the backend) can pin the stamp deterministically;
 * turbo's `globalEnv` declares the three variables so a cached build cannot
 * silently replay a stale identity.
 */

export interface ResolveReleaseStampOptions {
  /** The app package directory — its `package.json` supplies the version. */
  appDir: string
  /** Environment overrides; defaults to `process.env`. */
  env?: Record<string, string | undefined>
}

export function resolveReleaseStamp({
  appDir,
  env = process.env,
}: ResolveReleaseStampOptions): ReleaseStamp {
  return {
    commit: env['SANVI_GIT_COMMIT'] ?? gitShortSha(appDir) ?? 'unknown',
    version: readVersion(appDir),
    built_at: env['SANVI_BUILT_AT'] ?? new Date().toISOString(),
    environment: env['SANVI_ENVIRONMENT'] ?? 'local',
  }
}

function gitShortSha(cwd: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // Non-git checkout (a tarball, a Docker context) — the stamp still
    // carries version, timestamp and environment; `unknown` says plainly
    // that the commit could not be proven rather than inventing one.
    return null
  }
}

function readVersion(appDir: string): string {
  const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as { version?: string }
  return pkg.version ?? '0.0.0'
}
