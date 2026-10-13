<script lang="ts">
import Field from '../../src/Field.svelte'
import Input from '../../src/Input.svelte'

interface Props {
  label: string
  hint?: string
  error?: string
  required?: boolean
}

let { label, hint, error, required = false }: Props = $props()
</script>

<Field {label} {hint} {error} {required}>
  {#snippet children({ id, describedBy, invalid, required: controlRequired })}
    <Input {id} describedBy={describedBy} {invalid} required={controlRequired} />
  {/snippet}
</Field>
