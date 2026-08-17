<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'

const COPY = {
  title: 'No tenant data yet',
  description: 'The tenant admin console renders real data starting in phase 03.',
}
</script>

<Container size="lg" padding="6">
  <EmptyState title={COPY.title} description={COPY.description} />
</Container>
