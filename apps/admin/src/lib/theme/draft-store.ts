import { putTenantThemeDraft } from '@sanvi/api-client'
import type {
  LayoutOverride,
  TenantThemeDraftView,
  TenantThemeView,
  TokenValue,
  UpdateTenantThemeDraftCommand,
} from '@sanvi/api-client'
import { writable } from 'svelte/store'
import { apiClient } from '../api'

type PutDraftFn = (cmd: UpdateTenantThemeDraftCommand) => Promise<TenantThemeView>

let currentDraft: TenantThemeDraftView | null = null
let baselineTheme: TenantThemeView | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let savingState = false
let lastErrorMessage: string | null = null

export const themeDraft = writable<TenantThemeDraftView | null>(null)

export function initDraftStore(draft: TenantThemeDraftView): void {
  currentDraft = structuredClone(draft)
  baselineTheme = structuredClone(draft.theme)
  lastErrorMessage = null
  themeDraft.set(currentDraft)
}

export function getDraft(): TenantThemeDraftView | null {
  return currentDraft
}

export function isSaving(): boolean {
  return savingState
}

export function getLastError(): string | null {
  return lastErrorMessage
}

export function resetDraftStore(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  currentDraft = null
  baselineTheme = null
  savingState = false
  lastErrorMessage = null
  themeDraft.set(null)
}

function scheduleSave(customPut?: PutDraftFn, debounceMs = 300): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    void executeSave(customPut)
  }, debounceMs)
}

export async function saveDraftImmediately(customPut?: PutDraftFn): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  await executeSave(customPut)
}

async function executeSave(customPut?: PutDraftFn): Promise<void> {
  if (!currentDraft) return

  const cmd: UpdateTenantThemeDraftCommand = {
    theme_key: currentDraft.theme.theme_key,
    version: currentDraft.theme.version,
    token_overrides: currentDraft.theme.token_overrides,
    layout_overrides: currentDraft.theme.layout_overrides,
    custom_css: currentDraft.theme.custom_css,
  }

  savingState = true
  lastErrorMessage = null

  try {
    const updatedTheme = customPut
      ? await customPut(cmd)
      : await putTenantThemeDraft(apiClient, cmd)

    baselineTheme = structuredClone(updatedTheme)
    if (currentDraft) {
      currentDraft.theme = updatedTheme
      themeDraft.set(currentDraft)
    }
  } catch (err: unknown) {
    // Roll back optimistic state to baseline
    if (baselineTheme && currentDraft) {
      currentDraft.theme = structuredClone(baselineTheme)
      themeDraft.set(currentDraft)
    }
    lastErrorMessage = err instanceof Error ? err.message : String(err)
  } finally {
    savingState = false
  }
}

export function updateTokenOverride(path: string, value: TokenValue, customPut?: PutDraftFn): void {
  if (!currentDraft) return

  currentDraft.theme.token_overrides = {
    ...currentDraft.theme.token_overrides,
    [path]: value,
  }
  themeDraft.set(currentDraft)
  scheduleSave(customPut)
}

export function updateLayoutOverride(
  layout: string,
  override: LayoutOverride,
  customPut?: PutDraftFn,
): void {
  if (!currentDraft) return

  currentDraft.theme.layout_overrides = {
    ...currentDraft.theme.layout_overrides,
    [layout]: override,
  }
  themeDraft.set(currentDraft)
  scheduleSave(customPut)
}

export function setCustomCss(css: string | null, customPut?: PutDraftFn): void {
  if (!currentDraft) return

  currentDraft.theme.custom_css = css
  themeDraft.set(currentDraft)
  scheduleSave(customPut)
}

export function switchTheme(themeKey: string, version?: string, customPut?: PutDraftFn): void {
  if (!currentDraft) return

  currentDraft.theme.theme_key = themeKey
  if (version) {
    currentDraft.theme.version = version
  }
  themeDraft.set(currentDraft)
  scheduleSave(customPut)
}
