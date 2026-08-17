<script lang="ts">
import Field from '../../src/Field.svelte'
import Input from '../../src/Input.svelte'

interface Props {
  label: string
  hint?: string
  error?: string
}

let { label, hint, error }: Props = $props()
</script>

<Field {label} {hint} {error}>
  {#snippet children({ id, describedBy, invalid })}
    <Input {id} describedBy={describedBy} {invalid} />
  {/snippet}
</Field>
