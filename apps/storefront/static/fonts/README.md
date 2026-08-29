# Vendored Noto Sans JP subsets

Copied from `@fontsource-variable/noto-sans-jp` (OFL-1.1, Google Fonts) —
subsets 118/119 cover kana plus the most frequent kanji and are the only
files worth preloading (see `src/routes/+layout.svelte`). The package's
`exports` map can't serve `.woff2` files to JS imports directly, so the
preload targets are vendored here instead.

When bumping the dependency, re-copy the matching `files/` outputs.
