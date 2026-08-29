<script lang="ts">
import { currentLocale, t } from '@sanvi/i18n'
import { DetailShell } from '@sanvi/ui'
import type { DetailShellTab } from '@sanvi/ui'
import type { Snippet } from 'svelte'

interface Props {
  activeTab: 'gallery' | 'brand' | 'colors' | 'typography' | 'layout' | 'preview' | 'publish'
  children?: Snippet
}

const { activeTab, children }: Props = $props()

const tabs: DetailShellTab[] = $derived([
  { href: '/theme', label: t['admin.theme.nav.gallery']() },
  { href: '/theme/brand', label: t['admin.theme.nav.brand']() },
  { href: '/theme/colors', label: t['admin.theme.nav.colors']() },
  { href: '/theme/typography', label: t['admin.theme.nav.typography']() },
  { href: '/theme/layout', label: t['admin.theme.nav.layout']() },
  { href: '/theme/preview', label: t['admin.theme.nav.preview']() },
  { href: '/theme/publish', label: t['admin.theme.nav.publish']() },
])

const activeHref = $derived(activeTab === 'gallery' ? '/theme' : `/theme/${activeTab}`)
</script>

<DetailShell
  title={t['admin.theme.gallery.title']()}
  subtitle={t['admin.theme.gallery.description']()}
  {tabs}
  {activeHref}
>
  {@render children?.()}
</DetailShell>
