#!/usr/bin/env node
/**
 * Root `check:i18n-shards` entry (TASK-032) — runs the shard gate from
 * `@sanvi/lint-gates` over every app's built client output. Needs
 * `pnpm build` first, exactly like `check:budget`; `check:all` and
 * `check:quiet` both run it right after the turbo `build`+`check:budget`
 * stage.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'

const root = findWorkspaceRoot()
execFileSync(process.execPath, [join(root, 'packages', 'lint-gates', 'src', 'check-i18n-shards.mjs')], {
  stdio: 'inherit',
  cwd: root,
})
