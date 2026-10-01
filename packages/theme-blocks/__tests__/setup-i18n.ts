import { registerStorefrontSurface } from '@sanvi/i18n/surfaces/storefront'

// TASK-032: theme-blocks render only in the storefront, which registers the
// storefront surface — the surface that carries this package's `themeblocks`
// shard. Tests mirror that; a block reaching for a key outside the
// storefront's shards would fail loudly here first.
registerStorefrontSurface()
