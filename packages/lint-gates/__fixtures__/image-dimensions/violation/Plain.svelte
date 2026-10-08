<script lang="ts">
  let src = $state('/img.png')
</script>

<!-- The violation: no width, no height — the browser cannot reserve a box -->
<img src={src} alt="no dimensions" />

<img
  src={src}
  alt="multiline and still dimensionless"
/>
