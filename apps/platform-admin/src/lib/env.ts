export interface AppEnv {
  apiOrigin: string
  /** Per-request API timeout override (TASK-023 e2e); unset in production. */
  apiTimeoutMs: number | undefined
  mediaOrigin: string | undefined
  /** Ory Kratos's public API origin — `@sanvi/auth` calls it directly from the browser. */
  kratosOrigin: string
}

export function getAppEnv(): AppEnv {
  const apiOrigin = import.meta.env.VITE_API_ORIGIN
  if (!apiOrigin) {
    throw new Error('VITE_API_ORIGIN is required but was not set.')
  }
  const kratosOrigin = import.meta.env.VITE_KRATOS_ORIGIN
  if (!kratosOrigin) {
    throw new Error('VITE_KRATOS_ORIGIN is required but was not set.')
  }

  const apiTimeoutRaw = import.meta.env['VITE_API_TIMEOUT_MS'] as string | undefined
  const apiTimeoutParsed = apiTimeoutRaw ? Number(apiTimeoutRaw) : Number.NaN
  // Mirrors the storefront's normalizeMs: `0` would abort every request
  // instantly, so only a positive finite number is an override.
  const apiTimeoutMs =
    Number.isFinite(apiTimeoutParsed) && apiTimeoutParsed > 0 ? apiTimeoutParsed : undefined

  return {
    apiOrigin,
    apiTimeoutMs,
    mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined,
    kratosOrigin,
  }
}
