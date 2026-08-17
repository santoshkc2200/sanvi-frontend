/**
 * Stand-in for SvelteKit's `$env/dynamic/public` virtual module, which
 * `vitest` can't resolve on its own (it only exists via the `sveltekit()`
 * vite plugin, not loaded here — see `vitest.config.ts`'s alias comment).
 */
export const env: Record<string, string | undefined> = {
  PUBLIC_API_ORIGIN: 'https://api.example.test',
  PUBLIC_MEDIA_ORIGIN: '',
}
