import { bootSession } from '@sanvi/auth'
import { mount } from 'svelte'
import '@sanvi/ui/styles.css'
import { apiClient } from './lib/api'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('#app root element not found')

// Session must be known before the router resolves its first route — the
// guards in `App.svelte` assume `bootSession` has already settled (see
// `@sanvi/auth`'s `guards.ts`), so mounting waits on it rather than racing.
await bootSession(apiClient)

mount(App, { target })
