<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, EmptyState } from '@sanvi/ui'
</script>

<Container size="md" padding="6">
  <!-- A 404 is the whole page: its title is the h1 (TASK-027). -->
  <EmptyState
    title={t['errors.notFound.title']()}
    description={t['platform.notFound.description']()}
    titleTag="h1"
  />
</Container>
