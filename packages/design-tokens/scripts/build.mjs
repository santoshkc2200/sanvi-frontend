#!/usr/bin/env node

/**
 * Runs Style Dictionary build configs in order, then executes post-build.
 *
 * Usage:
 *   node scripts/build.mjs            # all targets
 *   node scripts/build.mjs light       # single target
 */

import StyleDictionary from 'style-dictionary'
import { configs } from '../config/config.mjs'
import { postBuild } from './post-build.mjs'

async function build() {
  console.log('\n🎨 Design Tokens Build\n')

  const targetLabel = process.argv[2]
  const isIosRequested = !targetLabel || targetLabel === 'ios-assets'

  const standardConfigs = configs.filter(
    ({ label }) => label !== 'ios-assets' && (!targetLabel || label === targetLabel),
  )

  const iosConfig = configs.find(({ label }) => label === 'ios-assets')

  const executionQueue = [...standardConfigs]
  if (isIosRequested && iosConfig) {
    executionQueue.push(iosConfig)
  }

  if (executionQueue.length === 0) {
    console.error(`✗ Unknown target: "${targetLabel}"`)
    console.error(`Available targets: ${configs.map((c) => c.label).join(', ')}`)
    process.exit(1)
  }

  let hasFailures = false

  for (const { label, config } of executionQueue) {
    process.stdout.write(`▶ Building ${label}... `)

    try {
      const sd = new StyleDictionary(config)
      await sd.buildAllPlatforms()
      console.log('✓')
    } catch (error) {
      console.log('✗')
      console.error(`\nBuild failed for target "${label}"\n`)
      console.error(error)
      hasFailures = true
    }
  }

  if (hasFailures) {
    console.error('\n❌ Build completed with errors.\n')
    process.exit(1)
  }

  console.log('\n✅ Build completed successfully.\n')
}

await build()
await postBuild()
