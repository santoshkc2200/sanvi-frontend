<script lang="ts">
import { t } from '../../src/translate'

let { onRender }: { onRender: (text: string) => void } = $props()

$effect(() => {
  onRender(t['consent.banner.title']())
})
</script>

<p>probe</p>
