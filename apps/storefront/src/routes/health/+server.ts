import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = () => {
  // `build` is the FR-1103 release stamp — the same four fields
  // `GET /api/v1/system/build` returns, so a synthetic monitor can compare
  // the served build against the deployment it probes.
  return json({ status: 'ok', version: __APP_VERSION__, build: __APP_BUILD__ })
}
