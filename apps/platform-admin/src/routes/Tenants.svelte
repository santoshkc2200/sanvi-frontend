<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'

const COPY = {
  title: 'No tenants yet',
  description:
    'Tenant lifecycle management lands in phase 03 (Platform Admin & Tenant Admin Consoles).',
}
</script>

<Container size="lg" padding="6">
  <EmptyState title={COPY.title} description={COPY.description} />
</Container>
