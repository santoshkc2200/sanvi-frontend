<script lang="ts">
import { onMount } from 'svelte'
import { getChapters, putChapters } from './api/media'
import { formatTimecode, parseTimecode } from './authoring/timecode'
import type { CourseApiContext } from './context'
import type { Chapter } from './model/asset'
import type { ChapterEditorLabels, VideoPlayerHandle } from './types'

const DEFAULT_LABELS: ChapterEditorLabels = {
  title: 'Chapters',
  empty: 'No chapters yet.',
  loadError: 'Could not load chapters.',
  saveError: 'Could not save chapters.',
  newLabel: 'New chapter',
  timestamp: 'Timestamp',
  label: 'Label',
  addAtPlayhead: 'Add at playhead',
  remove: 'Remove',
  cancel: 'Cancel',
  save: 'Save',
}

interface Draft extends Chapter {
  key: number
  timestampText: string
}
export let runtime: CourseApiContext
export let assetId: string
export let durationMs: number
export let player: VideoPlayerHandle | undefined = undefined
export let labels: ChapterEditorLabels = DEFAULT_LABELS

let nextKey = 0
let saved: Chapter[] = []
let drafts: Draft[] = []
let loading = true
let saving = false
let errors: string[] = []
$: dirty =
  drafts.length !== saved.length ||
  drafts.some(
    (draft, index) =>
      draft.label !== saved[index]?.label || draft.timestampMs !== saved[index]?.timestampMs,
  )

function toDraft(chapter: Chapter): Draft {
  return { ...chapter, key: nextKey++, timestampText: formatTimecode(chapter.timestampMs) }
}

function validate(): Chapter[] | null {
  const nextErrors: string[] = []
  for (const draft of drafts) {
    if (!draft.label.trim()) nextErrors.push('Every chapter needs a label.')
    if (draft.timestampMs < 0 || draft.timestampMs > durationMs)
      nextErrors.push(`“${draft.label || 'Untitled'}” is outside the video duration.`)
  }
  const sorted = [...drafts].sort((a, b) => a.timestampMs - b.timestampMs)
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    const previous = sorted[index - 1]
    if (current && previous && current.timestampMs <= previous.timestampMs) {
      nextErrors.push('Chapter timestamps must be unique.')
    }
  }
  errors = nextErrors
  return nextErrors.length ? null : sorted.map(({ label, timestampMs }) => ({ label, timestampMs }))
}

function updateLabel(key: number, label: string): void {
  drafts = drafts.map((draft) => (draft.key === key ? { ...draft, label } : draft))
}

function updateTimestamp(key: number, timestampText: string): void {
  const timestampMs = parseTimecode(timestampText)
  drafts = drafts.map((draft) =>
    draft.key === key
      ? { ...draft, timestampText, ...(timestampMs === null ? {} : { timestampMs }) }
      : draft,
  )
}

function addAtPlayhead(): void {
  const timestampMs = Math.round((player?.getCurrentTime() ?? 0) * 1000)
  drafts = [
    ...drafts,
    {
      key: nextKey++,
      label: labels.newLabel,
      timestampMs,
      timestampText: formatTimecode(timestampMs),
    },
  ]
}

async function save(): Promise<void> {
  const chapters = validate()
  if (!chapters) return
  saving = true
  errors = []
  try {
    saved = await putChapters(runtime, assetId, chapters)
    drafts = saved.map(toDraft)
  } catch {
    errors = [labels.saveError]
  } finally {
    saving = false
  }
}

onMount(() => {
  let active = true
  void getChapters(runtime, assetId)
    .then((chapters) => {
      if (active) {
        saved = chapters
        drafts = chapters.map(toDraft)
      }
    })
    .catch(() => {
      if (active) errors = [labels.loadError]
    })
    .finally(() => {
      if (active) loading = false
    })
  return () => {
    active = false
  }
})
</script>

{#if !loading}
  <section class="editor">
    <h3>{labels.title}</h3>
    {#if errors.length}<ul class="errors" role="alert">{#each errors as error}<li>{error}</li>{/each}</ul>{/if}
    {#if drafts.length === 0}<p>{labels.empty}</p>{/if}
    {#each drafts as draft (draft.key)}
      <div class="row">
        <button type="button" class="time" on:click={() => player?.seekTo(draft.timestampMs / 1000)}>{formatTimecode(draft.timestampMs)}</button>
        <label><span>{labels.timestamp}</span><input value={draft.timestampText} on:input={(event) => updateTimestamp(draft.key, event.currentTarget.value)} /></label>
        <label><span>{labels.label}</span><input value={draft.label} on:input={(event) => updateLabel(draft.key, event.currentTarget.value)} /></label>
        <button type="button" aria-label={labels.remove} on:click={() => drafts = drafts.filter((current) => current.key !== draft.key)}>×</button>
      </div>
    {/each}
    <div class="actions">
      <button type="button" on:click={addAtPlayhead}>{labels.addAtPlayhead}</button>
      {#if dirty}
        <button type="button" on:click={() => { drafts = saved.map(toDraft); errors = [] }}>{labels.cancel}</button>
        <button type="button" disabled={saving} on:click={() => void save()}>{labels.save}</button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .editor { display: grid; gap: .75rem; padding-top: .75rem; border-top: 1px solid #cbd5e1; }
  h3, p { margin: 0; } .row, .actions { display: flex; align-items: end; flex-wrap: wrap; gap: .5rem; }
  label { display: grid; gap: .25rem; flex: 1; min-width: 9rem; font-size: .875rem; } input { min-width: 0; padding: .375rem; }
  .time { font-family: ui-monospace, monospace; } .errors { margin: 0; color: #b42318; }
</style>
