import type { Component } from 'svelte'
import type {
  BlockSchema,
  ComponentTree,
  LayoutName,
  PageData,
  RenderedBlock,
  RenderedSlot,
  SlotAssignment,
} from './types'

export interface RegisteredBlock {
  type: string
  // biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic based on block type
  component: Component<any>
  schema: BlockSchema
}

const blockRegistry = new Map<string, RegisteredBlock>()

/** Set of layout names that are canonically locked against slot overrides */
export const LOCKED_LAYOUT_NAMES = new Set<string>(['storefront.checkout', 'checkout'])

export function registerBlock(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic based on block type
  component: Component<any>,
  schema: BlockSchema,
): void {
  if (!type || typeof type !== 'string') {
    throw new Error('Block type must be a non-empty string')
  }
  blockRegistry.set(type, { type, component, schema })
}

export function unregisterBlock(type: string): boolean {
  return blockRegistry.delete(type)
}

export function getBlock(type: string): RegisteredBlock | undefined {
  return blockRegistry.get(type)
}

export function hasBlock(type: string): boolean {
  return blockRegistry.has(type)
}

export function clearBlockRegistry(): void {
  blockRegistry.clear()
}

export function getRegisteredBlockTypes(): string[] {
  return Array.from(blockRegistry.keys())
}

/**
 * Renders a layout into a component tree:
 * 1. Resolves named slots against the layout's manifest / theme and registered blocks.
 * 2. Enforces locked slots (rejecting / ignoring attempts to override locked slots).
 * 3. Tolerates unknown block types gracefully (logs warning and skips without throwing).
 */
export function renderLayout(layout: LayoutName, data: PageData = {}): ComponentTree {
  const themeLayout = data.theme?.layouts?.[layout]
  // Lock enforcement relies on LOCKED_LAYOUT_NAMES because the resolved payload does not carry the locked flag.
  const isLayoutLocked = LOCKED_LAYOUT_NAMES.has(layout)

  // Determine slot list
  let slotNames: string[] = []

  if (themeLayout?.slots) {
    slotNames = [...themeLayout.slots]
  } else if (data.layoutOverrides?.slots && !isLayoutLocked) {
    slotNames = [...data.layoutOverrides.slots]
  } else {
    // Default fallback slots for standard layouts
    if (layout === 'storefront.home' || layout === 'home') {
      slotNames = ['hero', 'feature-grid', 'cta']
    } else if (layout === 'storefront.product' || layout === 'product') {
      slotNames = ['gallery', 'details', 'related']
    } else if (layout === 'storefront.checkout' || layout === 'checkout') {
      slotNames = ['summary', 'payment']
    } else {
      slotNames = []
    }
  }

  // Filter out hidden slots if not locked
  if (data.layoutOverrides?.hidden_slots && !isLayoutLocked) {
    const hiddenSet = new Set(data.layoutOverrides.hidden_slots)
    slotNames = slotNames.filter((s) => !hiddenSet.has(s))
  }

  const renderedSlots: RenderedSlot[] = []
  const renderedBlocks: RenderedBlock[] = []

  for (const slotName of slotNames) {
    const slotLocked = isLayoutLocked

    let assignments: SlotAssignment | undefined

    if (slotLocked) {
      // For locked slots, reject/ignore overrides in data.slots/data.blocks
      if (data.slots?.[slotName] || data.blocks?.[slotName]) {
        console.warn(
          `[theme-runtime] Attempted override of locked slot "${slotName}" in layout "${layout}" was rejected.`,
        )
      }
      // Canonical assignment for locked slot is its default slotName type
      assignments = slotName
    } else {
      assignments = data.slots?.[slotName] ?? data.blocks?.[slotName] ?? slotName
    }

    const blockList: RenderedBlock[] = []
    const rawItems = Array.isArray(assignments) ? assignments : [assignments]

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      if (!item) continue

      let blockType: string
      let blockProps: Record<string, unknown> = {}
      let blockId = `${layout}-${slotName}-${i}`

      if (typeof item === 'string') {
        blockType = item
      } else {
        blockType = item.type
        blockProps = item.props ?? {}
        if (item.id) blockId = item.id
      }

      // Look up block in registry (normalizing hyphens to underscores as fallback)
      const registered =
        blockRegistry.get(blockType) ??
        blockRegistry.get(blockType.replace(/-/g, '_')) ??
        blockRegistry.get(blockType.replace(/_/g, '-'))
      if (!registered) {
        // Tolerates unknown block types gracefully (skip + warn, never throw)
        console.warn(
          `[theme-runtime] Unknown block type "${blockType}" in slot "${slotName}" for layout "${layout}". Skipping.`,
        )
        continue
      }

      const renderedBlock: RenderedBlock = {
        id: blockId,
        slot: slotName,
        type: blockType,
        component: registered.component,
        props: blockProps,
        schema: registered.schema,
      }

      blockList.push(renderedBlock)
      renderedBlocks.push(renderedBlock)
    }

    renderedSlots.push({
      name: slotName,
      locked: slotLocked,
      blocks: blockList,
    })
  }

  return {
    layout,
    slots: renderedSlots,
    blocks: renderedBlocks,
  }
}
