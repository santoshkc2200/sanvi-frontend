<script lang="ts">
  // Comments may speak the rule: no blended_roas may exist. Code may not.
  export let roasPlatform: number | null = null
  export let roasSanvi: number | null = null
  const pair = { roasPlatform, roasSanvi }
</script>

<span>{roasPlatform} / {roasSanvi}</span>
