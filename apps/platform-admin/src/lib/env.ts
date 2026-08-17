export interface AppEnv {
  apiOrigin: string
  mediaOrigin: string | undefined
}

export function getAppEnv(): AppEnv {
  const apiOrigin = import.meta.env.VITE_API_ORIGIN
  if (!apiOrigin) {
    throw new Error('VITE_API_ORIGIN is required but was not set.')
  }

  return { apiOrigin, mediaOrigin: import.meta.env.VITE_MEDIA_ORIGIN || undefined }
}
