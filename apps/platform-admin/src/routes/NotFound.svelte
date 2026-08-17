<script lang="ts">
import { Container, EmptyState } from '@sanvi/ui'

const COPY = {
  title: 'Page not found',
  description: 'Check the URL, or use the navigation above.',
}
</script>

<Container size="md" padding="6">
  <EmptyState title={COPY.title} description={COPY.description} />
</Container>
