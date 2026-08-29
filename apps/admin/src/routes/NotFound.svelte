<script lang="ts">
import { t } from '@sanvi/i18n'
import { Container, EmptyState } from '@sanvi/ui'
</script>

<Container size="md" padding="6">
  <EmptyState title={t['admin.notFound.title']()} description={t['admin.notFound.description']()} />
</Container>
