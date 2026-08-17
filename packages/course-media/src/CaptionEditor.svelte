<script lang="ts">
import { onMount } from 'svelte'
import { getCaptionText, putCaption } from './api/media'
import { formatTimecode, formatVttTimestamp, parseVttTimestamp } from './authoring/timecode'
import {
  convertSrtToVtt,
  parseWebVtt,
  serializeWebVtt,
  type VttCue,
  validateWebVtt,
} from './authoring/webvtt'
import type { CourseApiContext } from './context'
import type { CaptionInfo } from './model/asset'
import type { CaptionEditorLabels, VideoPlayerHandle } from './types'

const DEFAULT_LABELS: CaptionEditorLabels = {
  title: 'Captions',
  empty: 'No caption cues yet.',
  saveError: 'Could not save captions.',
  language: 'Language',
  upload: 'Upload file',
  start: 'Start',
  end: 'End',
  text: 'Text',
  addAtPlayhead: 'Add at playhead',
  split: 'Split',
  remove: 'Remove',
  cancel: 'Cancel',
  save: 'Save',
}
const DEFAULT_CUE_DURATION_MS = 2_000
interface Draft extends VttCue {
  key: number
  startText: string
  endText: string
}
export let runtime: CourseApiContext
export let assetId: string
export let captionsVttUrl = ''
export let captionsReady = false
export let defaultLanguage: string
export let player: VideoPlayerHandle | undefined = undefined
export let onSaved: (caption: CaptionInfo) => void | Promise<void> = () => {}
export let labels: CaptionEditorLabels = DEFAULT_LABELS

let fileInput: HTMLInputElement
let nextKey = 0
let language = languageFromUrl(captionsVttUrl) ?? defaultLanguage
let saved: Draft[] = []
let drafts: Draft[] = []
let loading = true
let saving = false
let errors: string[] = []
$: dirty =
  drafts.length !== saved.length ||
  drafts.some(
    (draft, index) =>
      draft.startMs !== saved[index]?.startMs ||
      draft.endMs !== saved[index]?.endMs ||
      draft.text !== saved[index]?.text,
  )

function languageFromUrl(url: string): string | null {
  return url.match(/\/captions\/([^/]+)\.vtt$/)?.[1] ?? null
}
function toDraft(cue: VttCue): Draft {
  return {
    ...cue,
    key: nextKey++,
    startText: formatVttTimestamp(cue.startMs),
    endText: formatVttTimestamp(cue.endMs),
  }
}
function toCues(): VttCue[] {
  return drafts.map((draft, index) => ({
    index: index + 1,
    startMs: draft.startMs,
    endMs: draft.endMs,
    text: draft.text,
  }))
}
function setValidationErrors(cues: VttCue[], hasHeader: boolean): boolean {
  const validation = validateWebVtt(cues, hasHeader)
  errors = validation.map((error) =>
    error.cueIndex === null ? error.message : `Cue ${error.cueIndex}: ${error.message}`,
  )
  return validation.length === 0
}
function update(key: number, patch: Partial<Draft>): void {
  drafts = drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft))
}
function addAtPlayhead(): void {
  const startMs = Math.round((player?.getCurrentTime() ?? 0) * 1000)
  const endMs = startMs + DEFAULT_CUE_DURATION_MS
  drafts = [...drafts, toDraft({ index: 0, startMs, endMs, text: '' })].sort(
    (a, b) => a.startMs - b.startMs,
  )
}
function split(key: number): void {
  const index = drafts.findIndex((draft) => draft.key === key)
  const cue = drafts[index]
  if (!cue) return
  const midpoint = Math.round((cue.startMs + cue.endMs) / 2)
  if (midpoint <= cue.startMs || midpoint >= cue.endMs) return
  drafts = [
    ...drafts.slice(0, index),
    { ...cue, endMs: midpoint, endText: formatVttTimestamp(midpoint) },
    toDraft({ index: 0, startMs: midpoint, endMs: cue.endMs, text: '' }),
    ...drafts.slice(index + 1),
  ]
}
async function importFile(files: FileList | null): Promise<void> {
  const file = files?.[0]
  if (!file) return
  const raw = await file.text()
  const parsed = parseWebVtt(/\.srt$/i.test(file.name) ? convertSrtToVtt(raw) : raw)
  if (setValidationErrors(parsed.cues, parsed.hasHeader)) drafts = parsed.cues.map(toDraft)
}
async function save(): Promise<void> {
  const cues = toCues()
  if (!setValidationErrors(cues, true)) return
  saving = true
  try {
    const info = await putCaption(runtime, assetId, language, serializeWebVtt(cues))
    saved = drafts
    await onSaved(info)
  } catch {
    errors = [labels.saveError]
  } finally {
    saving = false
  }
}

onMount(() => {
  let active = true
  if (!captionsReady) {
    loading = false
    return () => {
      active = false
    }
  }
  const existingLanguage = languageFromUrl(captionsVttUrl) ?? defaultLanguage
  void getCaptionText(runtime, assetId, existingLanguage)
    .then((text) => {
      if (active) {
        const loaded = parseWebVtt(text).cues.map(toDraft)
        saved = loaded
        drafts = loaded
      }
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
    <label>{labels.language}<input bind:value={language} /></label>
    <input bind:this={fileInput} type="file" accept=".vtt,.srt,text/vtt" class="sr-only" on:change={(event) => void importFile(event.currentTarget.files)} />
    {#if drafts.length === 0}<p>{labels.empty}</p>{/if}
    {#each drafts as draft (draft.key)}
      <div class="cue">
        <button type="button" class="time" on:click={() => player?.seekTo(draft.startMs / 1000)}>{formatTimecode(draft.startMs)}</button>
        <label>{labels.start}<input value={draft.startText} on:input={(event) => { const value = event.currentTarget.value; const parsed = parseVttTimestamp(value); update(draft.key, { startText: value, ...(parsed === null ? {} : { startMs: parsed }) }) }} /></label>
        <label>{labels.end}<input value={draft.endText} on:input={(event) => { const value = event.currentTarget.value; const parsed = parseVttTimestamp(value); update(draft.key, { endText: value, ...(parsed === null ? {} : { endMs: parsed }) }) }} /></label>
        <button type="button" on:click={() => split(draft.key)}>{labels.split}</button>
        <button type="button" on:click={() => drafts = drafts.filter((current) => current.key !== draft.key)}>{labels.remove}</button>
        <label class="text">{labels.text}<input value={draft.text} on:input={(event) => update(draft.key, { text: event.currentTarget.value })} /></label>
      </div>
    {/each}
    <div class="actions">
      <button type="button" on:click={addAtPlayhead}>{labels.addAtPlayhead}</button>
      <button type="button" on:click={() => fileInput?.click()}>{labels.upload}</button>
      {#if dirty}
        <button type="button" on:click={() => { drafts = saved; errors = [] }}>{labels.cancel}</button>
        <button type="button" disabled={saving} on:click={() => void save()}>{labels.save}</button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .editor { display: grid; gap: .75rem; padding-top: .75rem; border-top: 1px solid #cbd5e1; } h3, p { margin: 0; }
  label { display: grid; gap: .25rem; font-size: .875rem; } input { min-width: 0; padding: .375rem; }
  .cue { display: flex; flex-wrap: wrap; align-items: end; gap: .5rem; padding: .5rem; border: 1px solid #cbd5e1; border-radius: .375rem; } .cue label { min-width: 8rem; flex: 1; } .cue .text { flex-basis: 100%; }
  .actions { display: flex; flex-wrap: wrap; gap: .5rem; } .time { font-family: ui-monospace, monospace; } .errors { margin: 0; color: #b42318; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
</style>
