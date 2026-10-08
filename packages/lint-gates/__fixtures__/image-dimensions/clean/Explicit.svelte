<script lang="ts">
  let src = $state('/img.png')
  let width = $state(640)
  let height = $state(480)
</script>

<img src={src} alt="explicit" width={1200} height={600} loading="lazy" />

<img
  src={src}
  alt="shorthand counts"
  {width}
  {height}
/>

<iframe
  title="embed with dimensions"
  src="https://example.test/embed"
  width={560}
  height={315}
></iframe>

<!-- sanvi-dimensions-ignore: third-party widget that sizes itself -->
<img src={src} alt="suppressed with a visible reason" />
