import { registerStorefrontSurface } from '@sanvi/i18n/surfaces/storefront'

// TASK-032: component tests get the same catalog shards the app's boot
// registers — a test that renders a key outside this surface fails loudly
// (raw key + console error) instead of silently passing with every key in
// the package available, which is how shard leaks reach production.
registerStorefrontSurface()
