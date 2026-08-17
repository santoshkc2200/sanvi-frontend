export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
}

export interface LectureImageLabels {
  imagePreview: string
  close: string
}

export interface VideoPlayerLabels {
  loading: string
  forbidden: string
  playbackUnavailable: string
  quality: string
  qualityAuto: string
  qualityLevel: (height: number) => string
  qualityFallback: (index: number) => string
  fullscreen: string
}

export interface ChapterEditorLabels {
  title: string
  empty: string
  loadError: string
  saveError: string
  newLabel: string
  timestamp: string
  label: string
  addAtPlayhead: string
  remove: string
  cancel: string
  save: string
}

export interface CaptionEditorLabels {
  title: string
  empty: string
  saveError: string
  language: string
  upload: string
  start: string
  end: string
  text: string
  addAtPlayhead: string
  split: string
  remove: string
  cancel: string
  save: string
}
