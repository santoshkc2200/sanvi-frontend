/**
 * Stand-in for SvelteKit's `$env/dynamic/public` virtual module, which
 * `vitest` can't resolve on its own (it only exists via the `sveltekit()`
 * vite plugin, not loaded here — see `vitest.config.ts`'s alias comment).
 */
export const env: Record<string, string | undefined> = {
  PUBLIC_API_ORIGIN: 'https://api.example.test',
  PUBLIC_MEDIA_ORIGIN: '',
  PUBLIC_KRATOS_ORIGIN: 'https://kratos.example.test',
  // The conversion beacon's site key. Set here — not per-test — because
  // `getAppEnv()` first runs at module-eval time (`lib/auth.ts` builds its
  // client during import), before any test body could set it. Tests that
  // exercise the emission gate override `PUBLIC_TRACKING_SITE_KEY` with a
  // module reset (see `tracking-beacon.test.ts`).
  PUBLIC_TRACKING_SITE_KEY: 'test-site-key',
}
