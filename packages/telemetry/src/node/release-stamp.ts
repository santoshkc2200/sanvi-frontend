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
 * standing in for the backend) can pin the stamp deterministically. Turbo's
 * `globalEnv` lists the three variables, which keeps them in the cache key —
 * but only when the pipeline actually sets them. Unset, as in a plain local
 * build, turbo keys on file hashes alone, so a rebuild at a tree-identical
 * commit (a rebase, a diff-free merge) can replay a stale commit/built_at;
 * that is an approximation local builds accept, not a guarantee.
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

/**
 * A fixed 12-hex truncation — not plain `--short`, whose length varies as git
 * extends it for uniqueness. Correlation against the backend pipeline's
 * `GIT_COMMIT` (FR-1102/1103) is therefore prefix-match: both stamps truncate
 * the same full sha, so compare by the shorter prefix. The two repos have not
 * agreed a length, so string-equality is never the rule.
 */
function gitShortSha(cwd: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
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
