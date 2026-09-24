import { type Readable, writable } from 'svelte/store'
import type { ResolvedTheme } from './types'

export const DEFAULT_FALLBACK_THEME: ResolvedTheme = {
  theme_key: 'base',
  theme_version: '0.1.0',
  theme_api: '^1.0.0',
  capabilities: [],
  tokens: {},
  css_vars: '',
  layouts: {},
  fonts: [],
  theme_assets: { screenshots: [] },
  brand_assets: {},
  revision: 0,
  locale: 'en',
  etag: '""',
}

const themeStore = writable<ResolvedTheme>(DEFAULT_FALLBACK_THEME)

/** Single source of truth for the current resolved theme */
export const theme: Readable<ResolvedTheme> = {
  subscribe: themeStore.subscribe,
}

export interface ParsedCssVars {
  light: Record<string, string>
  dark: Record<string, string>
}

/**
 * Parses CSS custom properties from a precompiled css_vars block.
 * Handles both the base `:root` block (light) and `@media (prefers-color-scheme: dark)` block (dark).
 */
export function parseCssVars(css: string): ParsedCssVars {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}

  if (!css || typeof css !== 'string') {
    return { light, dark }
  }

  // 1. Find dark media query block: @media (prefers-color-scheme: dark) { ... }
  let remainingCss = css
  const darkMediaRegex = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/i
  const darkMatch = darkMediaRegex.exec(css)

  if (darkMatch && darkMatch.index !== undefined) {
    const startIndex = darkMatch.index + darkMatch[0].length
    let braceCount = 1
    let endIndex = startIndex

    while (endIndex < css.length && braceCount > 0) {
      if (css[endIndex] === '{') {
        braceCount++
      } else if (css[endIndex] === '}') {
        braceCount--
      }
      endIndex++
    }

    const darkContent = css.slice(startIndex, endIndex - (braceCount === 0 ? 1 : 0))
    extractDeclarations(darkContent, dark)

    remainingCss = css.slice(0, darkMatch.index) + css.slice(endIndex)
  }

  // 2. Also extract from explicit dark theme selectors: [data-theme="dark"] or .dark
  const darkSelectorRegex = /(?:\[data-theme=["']?dark["']?\]|\.dark)\s*\{([^}]+)\}/gi
  for (const selectorMatch of remainingCss.matchAll(darkSelectorRegex)) {
    const matched = selectorMatch[1]
    if (matched) {
      extractDeclarations(matched, dark)
    }
  }

  // 3. Extract remaining light declarations from top-level or :root blocks
  extractDeclarations(remainingCss, light)

  return { light, dark }
}

function extractDeclarations(cssBlock: string, target: Record<string, string>): void {
  const declRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+?)\s*(?:;|(?=\}))/g
  for (const match of cssBlock.matchAll(declRegex)) {
    const prop = match[1]?.trim()
    const val = match[2]?.trim()
    if (prop && val) {
      target[prop] = val
    }
  }
}

/**
 * Checks if dark mode is currently active according to:
 * 1. Explicit tenant override via `data-theme="dark"` / `data-theme="light"` on documentElement
 * 2. `.dark` class on documentElement
 * 3. System preference `prefers-color-scheme: dark` when in auto/unset mode
 */
export function isDarkModeActive(): boolean {
  if (typeof document === 'undefined') return false

  const docEl = document.documentElement
  const dataTheme = docEl.getAttribute('data-theme')?.toLowerCase()

  if (dataTheme === 'dark' || docEl.classList.contains('dark')) {
    return true
  }
  if (dataTheme === 'light' || docEl.classList.contains('light')) {
    return false
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  return false
}

// Track properties applied to documentElement so we can cleanly remove stale ones on theme swap
let appliedProperties = new Set<string>()

/**
 * Client-side token swap for editor live preview.
 * Sets/removes CSS custom properties on document.documentElement from resolved.css_vars,
 * respecting the existing dark mode strategy.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  themeStore.set(resolved)

  if (typeof document === 'undefined') {
    return
  }

  const { light, dark } = parseCssVars(resolved?.css_vars || '')
  const isDark = isDarkModeActive()

  const targetProperties: Record<string, string> = { ...light }
  if (isDark) {
    for (const [key, val] of Object.entries(dark)) {
      targetProperties[key] = val
    }
  }

  const docEl = document.documentElement

  // Remove previously applied properties that are no longer present
  for (const prop of appliedProperties) {
    if (!(prop in targetProperties)) {
      docEl.style.removeProperty(prop)
    }
  }

  // Set all current properties
  for (const [prop, val] of Object.entries(targetProperties)) {
    docEl.style.setProperty(prop, val)
  }

  appliedProperties = new Set(Object.keys(targetProperties))
}

/**
 * The exact CSS content {@link themeStyleTag} places inside its
 * `<style id="sanvi-theme">` element — the tenant's `css_vars` plus custom
 * CSS, with the `</style`/`<!--` break-out escapes applied. TASK-024's CSP
 * tightening removed `style-src 'unsafe-inline'`, so the storefront's
 * server hook allows this one inline style by a per-request `sha256` hash of
 * *this* string; both the tag renderer and the hook must therefore produce
 * byte-identical content, which is why the two share this helper.
 */
export function themeStyleCss(resolved: ResolvedTheme): string {
  if (!resolved) return ''

  let css = resolved.css_vars || ''
  if (resolved.custom_css) {
    css += `\n${resolved.custom_css}`
  }

  return css.replace(/<\/style/gi, '<\\/style').replace(/<!--/g, '<\\!--')
}

/**
 * SSR-safe helper that generates the literal `<style>` tag string to inline in HTML <head>.
 * Safely escapes style content to prevent breaking out of the style tag.
 */
export function themeStyleTag(resolved: ResolvedTheme): string {
  return `<style id="sanvi-theme">${themeStyleCss(resolved)}</style>`
}
