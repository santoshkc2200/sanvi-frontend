export interface AppEnv {
  apiOrigin: string
  mediaOrigin: string | undefined
}

/**
 * Vite inlines `import.meta.env.VITE_*` at build time — unlike the
 * SvelteKit apps' `$env/dynamic/private`, there is no per-request read, so
 * a misconfigured deploy fails at build/boot, not on first request.
 */
export function getAppEnv(): AppEnv {
  const apiOrigin = import.meta.env.VITE_API_ORIGIN
  if (!apiOrigin) {
    throw new Error('VITE_API_ORIGIN is required but was not set.')
  }

  return { apiOrigin, mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined }
}
