/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN: string
  readonly VITE_MEDIA_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Injected by `vite.config.ts`'s `define` from `package.json`'s version. */
declare const __APP_VERSION__: string
