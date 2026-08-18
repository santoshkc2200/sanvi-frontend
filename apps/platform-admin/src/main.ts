import { bootSession } from '@sanvi/auth'
import { mount } from 'svelte'
import '@sanvi/ui/styles.css'
import { apiClient } from './lib/api'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('#app root element not found')

// Session must be known before the router resolves its first route — see
// `@sanvi/admin`'s identical `main.ts` comment.
await bootSession(apiClient)

mount(App, { target })
