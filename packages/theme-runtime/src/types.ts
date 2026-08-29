import type { components } from '@sanvi/api-client'
import type { Component } from 'svelte'

export type ResolvedTheme = components['schemas']['ResolvedTheme']
export type ResolvedLayout = components['schemas']['ResolvedLayout']
export type FontSpec = components['schemas']['FontSpec']
export type BrandAssetUrls = components['schemas']['BrandAssetUrls']
export type ThemeAssetUrls = components['schemas']['ThemeAssetUrls']

export interface BlockPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'image' | 'color' | 'text' | 'object' | 'array' | string
  label?: string
  description?: string
  required?: boolean
  default?: unknown
  options?: Array<{ label: string; value: unknown }>
}

export interface BlockSchema {
  name: string
  version?: string
  description?: string
  category?: string
  properties?: Record<string, BlockPropertySchema>
  [key: string]: unknown
}

export type LayoutName =
  | 'storefront.home'
  | 'storefront.product'
  | 'storefront.checkout'
  | (string & {})

export interface BlockInstanceData {
  type: string
  props?: Record<string, unknown>
  id?: string
  [key: string]: unknown
}

export type SlotAssignment = string | BlockInstanceData | BlockInstanceData[]

export interface PageData {
  theme?: ResolvedTheme
  slots?: Record<string, SlotAssignment>
  blocks?: Record<string, SlotAssignment>
  layoutOverrides?: {
    slots?: string[]
    hidden_slots?: string[]
  }
  data?: Record<string, unknown>
  locale?: string
  [key: string]: unknown
}

export interface RenderedBlock {
  id: string
  slot: string
  type: string
  // biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic based on block type
  component: Component<any>
  props: Record<string, unknown>
  schema?: BlockSchema
}

export interface RenderedSlot {
  name: string
  locked: boolean
  blocks: RenderedBlock[]
}

export interface ComponentTree {
  layout: LayoutName
  slots: RenderedSlot[]
  blocks: RenderedBlock[]
}
