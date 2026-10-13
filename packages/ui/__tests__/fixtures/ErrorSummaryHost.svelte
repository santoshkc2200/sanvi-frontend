<script lang="ts">
import ErrorSummary from '../../src/ErrorSummary.svelte'

let {
  items = [],
  title,
}: {
  items: { id: string; label?: string; message: string }[]
  title?: string
} = $props()

let summary: ErrorSummary | undefined = $state()

// Forwards the summary's focus() so tests can drive the failed-submit
// behavior through the host's own instance (render().component).
export function focusSummary(): void {
  summary?.focusSummary()
}
</script>

<form>
  <ErrorSummary bind:this={summary} {items} {title} />
  <input id="field-name" name="name" aria-label="Campaign name" />
  <select id="field-objective" name="objective" aria-label="Objective">
    <option value="">Choose</option>
  </select>
</form>
