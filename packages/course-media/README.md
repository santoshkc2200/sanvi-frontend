# @sanvi/course-media

Framework-agnostic within Svelte: no React, no Next.js, and no dependency on
any other Sanvi package — it is adopted standalone by whichever app needs
media (upload, HLS playback, captions, images) when a product phase needs it.

Use it only in browser-rendered Svelte components: create controllers and mount
the `VideoPlayer` from `onMount`-safe components. The package itself can be
imported by SvelteKit server code because browser APIs are not touched at module
load time.

```svelte
<script lang="ts">
  import { VideoPlayer, type CourseApiContext, type MediaAsset } from '@sanvi/course-media'

  export let runtime: CourseApiContext
  export let asset: MediaAsset
</script>

<VideoPlayer {runtime} {asset} />
```

`MediaUploadController` and `ImageUploadController` expose readable Svelte
stores. Create them in a component and call `destroy()` from `onDestroy`.
`ChapterEditor` and `CaptionEditor` pass their labels in explicitly (`labels`
props, no hardcoded strings) so they stay compatible with `@sanvi/i18n` once
that package lands.
