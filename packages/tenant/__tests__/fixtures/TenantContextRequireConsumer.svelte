<script lang="ts">
import { requireTenantContext } from '../../src/context'

const tenant = requireTenantContext()
</script>

<div data-testid="consumer">{tenant.slug}</div>
