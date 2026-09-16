/**
 * Per-app Lighthouse CI config (TASK-031) — extends the pinned base config in
 * the repo root. Run via `pnpm check:lighthouse`, which invokes
 * `lhci collect` with this file from the app directory.
 */
module.exports = require('../../lighthouserc.cjs').forApp('admin')
