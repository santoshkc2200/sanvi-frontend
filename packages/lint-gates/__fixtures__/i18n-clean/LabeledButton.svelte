<script lang="ts">
  interface Props {
    label: string
    ariaLabel: string
    count: number
  }

  let { label, ariaLabel, count }: Props = $props()
</script>

<button type="button" aria-label={ariaLabel} onclick={() => count++}>
  {label}
</button>
<p>{count}</p>
