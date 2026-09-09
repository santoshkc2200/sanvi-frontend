<script lang="ts">
import Badge from '../Badge.svelte'
import { AD_REASON_TONES, type AdReasonCategory } from './reasons'

/**
 * One taxonomy category as a badge (phase 10, TASK-015). Presentational by
 * the labels-as-data rule: the caller supplies the localized label, this
 * component owns only the tone mapping — which is where the screen's
 * load-bearing distinction lives. A directive-decided suppression renders
 * neutral on purpose: it is the privacy system working, and giving it an
 * alert colour would read as an incident. The label text carries the
 * meaning; the tone is never the only encoding.
 */
interface Props {
  category: AdReasonCategory
  label: string
  class?: string
}

let { category, label, class: className = '' }: Props = $props()

const tone = $derived(AD_REASON_TONES[category])
</script>

<Badge variant={tone} class={className}>{label}</Badge>
