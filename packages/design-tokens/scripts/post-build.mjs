#!/usr/bin/env node

/**
 * Runs after SD generation + tsc compilation.
 * Bundles CSS files into tokens.css and generates the TS barrel index.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSS_DIR = path.join(ROOT, 'dist/css')
const TS_DIR = path.join(ROOT, 'dist/ts')

// ─── fs helpers ────────────

function exists(p) {
  return fs.existsSync(p)
}
function read(p) {
  return fs.readFileSync(p, 'utf8')
}
function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
}

export async function postBuild() {
  console.log('\n📦 Running post-build...\n')

  // ─── Tailwind theme (optional) ────────────

  const themeSrc = path.join(ROOT, 'src/theme.css')
  if (exists(themeSrc)) {
    write(path.join(CSS_DIR, 'tailwind-theme.css'), read(themeSrc))
    console.log('✓ dist/css/tailwind-theme.css copied')
  } else {
    console.warn('⚠️ No src/theme.css found — skipping tailwind-theme copy.')
  }

  // ─── CSS bundle ────────────
  // Order matters: primitives → light → dark

  const cssFiles = ['primitives.css', 'light.css', 'dark.css']
  const cssParts = ['/**', ' * Auto-generated.', ' * Do not edit.', ' */', '']

  for (const file of cssFiles) {
    const filePath = path.join(CSS_DIR, file)
    if (!exists(filePath)) {
      console.warn(`⚠️ Missing CSS file: ${file}`)
      continue
    }
    cssParts.push(
      '/* ------------------------------------------------------------------ */',
      `/* ${file} */`,
      '/* ------------------------------------------------------------------ */',
      '',
      read(filePath),
      '',
    )
  }

  write(path.join(CSS_DIR, 'tokens.css'), cssParts.join('\n'))
  console.log('✓ dist/css/tokens.css generated')

  // ─── TS barrel index ────────────
  // Style Dictionary emits `dist/ts/<theme>.ts`; `tsc` (which produces the
  // `.js`/`.d.ts` pairs) runs *after* this script in the `build` task, so
  // the module list must be built from the `.ts` sources — filtering on
  // `.js` here finds nothing on a clean dist and skips the barrel entirely.
  const modules = ['primitives', 'light', 'dark'].filter((name) =>
    exists(path.join(TS_DIR, `${name}.ts`)),
  )

  if (modules.length === 0) {
    console.warn('⚠️ No dist/ts/*.ts theme sources found — skipping TS barrel generation.')
    return
  }

  const indexContent = [
    '/** Auto-generated. Do not edit. */',
    '',
    ...modules.flatMap((name) => {
      const pascal = name.charAt(0).toUpperCase() + name.slice(1)
      return [
        `export * as ${name}Tokens from './${name}.js';`,
        `export { tokens as ${pascal}TokensObj } from './${name}.js';`,
        `export type { TokenKey as ${pascal}TokenKey, TokenValue as ${pascal}TokenValue } from './${name}.js';`,
      ]
    }),
    '',
  ].join('\n')

  write(path.join(TS_DIR, 'index.ts'), indexContent)
  console.log('✓ dist/ts/index.ts generated')

  console.log('\n✅ Post-build complete.\n')
}
