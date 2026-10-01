import type { Plugin } from 'vite'
import {
  buildContentSecurityPolicyForApp,
  type CspAppPresetOptions,
  type SanviApp,
} from './index.ts'

export interface SanviCspMetaPluginOptions {
  /**
   * Appends `'unsafe-inline'` to `style-src` — **dev only**. `vite dev`
   * injects component CSS as `<style>` elements created at runtime, which
   * CSP blocks without an inline-style allowance; production builds extract
   * CSS to files loaded via `<link>`, so they never need it. Vite configs
   * pass `mode !== 'production'` from their own `defineConfig(({ mode }))`
   * scope, and the e2e suites run against production builds, so the strict
   * policy is what every gate and every deployed build exercises. There is
   * deliberately no equivalent for `script-src`: kit hashes its own inline
   * scripts, and a script-src relaxation has no dev-only excuse.
   *
   * @default false
   */
  devInlineStyles?: boolean
}

/**
 * Injects `<meta http-equiv="Content-Security-Policy">` into `index.html`
 * for the Vite SPA apps (`admin`, `platform-admin`) during `vite dev`/`vite
 * build`/`vite preview` — the same builder the SvelteKit apps use as a
 * response header, applied through the delivery mechanism a static SPA
 * actually has in dev. Production static hosting is expected to set the real
 * header at the CDN/hosting layer instead (`frame-ancestors` only works
 * there — `buildContentSecurityPolicy` already omits it from `'meta'` output
 * because browsers ignore it in a meta tag).
 */
export function sanviCspMetaPlugin(
  app: SanviApp,
  options: CspAppPresetOptions,
  pluginOptions: SanviCspMetaPluginOptions = {},
): Plugin {
  return {
    name: 'sanvi-csp-meta',
    transformIndexHtml(html) {
      const csp = buildContentSecurityPolicyForApp(app, options)
      // The trailing space anchors the match on the element directive:
      // `style-src-attr` also contains `style-src`, and the relaxation must
      // never land there.
      const content = pluginOptions.devInlineStyles
        ? csp.replace('style-src ', "style-src 'unsafe-inline' ")
        : csp
      const meta = `<meta http-equiv="Content-Security-Policy" content="${content.replace(/"/g, '&quot;')}">`
      if (!html.includes('</head>')) {
        // A silent no-op here ships the app with no CSP at all while the
        // build stays green — fail the build instead.
        throw new Error(
          `sanvi-csp-meta: no </head> found in index.html — cannot inject the CSP meta tag`,
        )
      }
      return html.replace('</head>', `  ${meta}\n  </head>`)
    },
  }
}
