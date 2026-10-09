<script lang="ts">
import AsyncBoundary from '../../src/errors/AsyncBoundary.svelte'
import BoundaryCrasher from './BoundaryCrasher.svelte'

let crashes = $state(true)
</script>

<p data-testid="outside">shell around the panel</p>
<AsyncBoundary
	title="Panel failed"
	description="This panel could not load."
	retryLabel="Try this panel again"
	onRetry={() => {
		crashes = false
	}}
	traceLine="Reference: abc123"
	diagnosticsText="Sanvi diagnostics\ntrace_id: abc123"
	copyLabel="Copy diagnostics"
	copiedLabel="Copied!"
>
	<BoundaryCrasher {crashes} />
</AsyncBoundary>
