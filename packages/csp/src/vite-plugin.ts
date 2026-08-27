import type { Plugin } from 'vite'
import {
  buildContentSecurityPolicyForApp,
  type CspAppPresetOptions,
  type SanviApp,
} from './index.ts'

/**
 * Injects `<meta http-equiv="Content-Security-Policy">` into `index.html`
 * for the Vite SPA apps (`admin`, `platform-admin`) during `vite dev`/`vite
 * build`/`vite preview` — the same builder the SvelteKit apps use as a
 * response header, applied through the delivery mechanism a static SPA
 * actually has in dev. Production static hosting is expected to set the
 * real header at the CDN/hosting layer instead (`frame-ancestors` only
 * works there — `buildContentSecurityPolicy` already omits it from `'meta'`
 * output because browsers ignore it in a meta tag).
 */
export function sanviCspMetaPlugin(app: SanviApp, options: CspAppPresetOptions): Plugin {
  return {
    name: 'sanvi-csp-meta',
    transformIndexHtml(html) {
      const csp = buildContentSecurityPolicyForApp(app, options)
      const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`
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
