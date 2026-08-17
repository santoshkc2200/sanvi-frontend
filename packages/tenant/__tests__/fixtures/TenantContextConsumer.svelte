<script lang="ts">
import { getTenantContext } from '../../src/context'

const tenant = getTenantContext()
</script>

<div data-testid="consumer">{tenant ? tenant.slug : 'none'}</div>
