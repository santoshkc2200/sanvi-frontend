<script lang="ts">
import { createEventDispatcher } from 'svelte'
import { formatTimecode } from './authoring/timecode'
import type { Chapter } from './model/asset'

export let chapters: Chapter[] = []
export let currentTimeSec = 0
export let title = 'Chapters'
const dispatch = createEventDispatcher<{ seek: number }>()

function activeChapterIndex(): number {
  const currentMs = currentTimeSec * 1000
  let active = -1
  for (let index = 0; index < chapters.length; index += 1) {
    if ((chapters[index]?.timestampMs ?? Number.POSITIVE_INFINITY) <= currentMs) active = index
    else break
  }
  return active
}

function select(timestampMs: number): void {
  dispatch('seek', timestampMs)
}
</script>

{#if chapters.length}
  <nav aria-label={title} class="chapters">
    {#each chapters as chapter, index (`${chapter.timestampMs}-${chapter.label}`)}
      <button
        type="button"
        class:active={index === activeChapterIndex()}
        aria-current={index === activeChapterIndex() ? 'true' : undefined}
        on:click={() => select(chapter.timestampMs)}
      >
        <time>{formatTimecode(chapter.timestampMs)}</time>
        <span>{chapter.label}</span>
      </button>
    {/each}
  </nav>
{/if}

<style>
  .chapters { display: grid; gap: .25rem; }
  button { display: flex; gap: .5rem; width: 100%; padding: .375rem .5rem; text-align: left; border: 0; border-radius: .25rem; background: transparent; cursor: pointer; }
  button:hover, button.active { background: #f1f5f9; }
  time { min-width: 3.5rem; font-family: ui-monospace, monospace; font-size: .75rem; }
</style>
