export interface AppEnv {
  apiOrigin: string
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

  return { apiOrigin, mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined, kratosOrigin }
}
