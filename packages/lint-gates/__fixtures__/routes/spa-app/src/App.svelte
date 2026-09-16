<script lang="ts">
import type { RouteDefinition } from '@sanvi/spa-router'
import { createRouter } from '@sanvi/spa-router'

const routes: RouteDefinition[] = [
  {
    path: '',
    load: () => import('./routes/Dashboard.svelte'),
  },
  {
    // a comment between path and load, like the real App.svelte has
    path: 'payments/:id',
    load: () => import('./routes/PaymentDetail.svelte'),
  },
  {
    path: 'no-load-here',
    // deliberately no load import — must be skipped by the enumerator
    guard: () => true,
  },
  { path: 'login', load: () => import('./routes/Login.svelte') },
]

createRouter({ routes, notFound: () => import('./routes/NotFound.svelte') })
</script>
