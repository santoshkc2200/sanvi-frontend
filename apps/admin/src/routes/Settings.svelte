<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'

const COPY = {
  title: 'Settings',
  description: 'Tenant settings land alongside the admin console in phase 03.',
}
</script>

<Container size="lg" padding="6">
  <EmptyState title={COPY.title} description={COPY.description} />
</Container>
