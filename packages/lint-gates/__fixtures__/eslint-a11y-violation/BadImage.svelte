<script lang="ts">
  let src = '/course-thumbnail.jpg'
</script>

<!-- Violates svelte/a11y-alt-text — <img> with no alt attribute. -->
<img {src} />
