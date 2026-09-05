import { getContext, hasContext, setContext } from 'svelte'
import type { OrderItem } from './types'

export const DEFAULT_SAMPLE_ITEMS: OrderItem[] = [
  {
    id: 'item-foundations-course',
    name: 'Full Platform Access & Foundations Course',
    quantity: 1,
    amount_minor: 4800,
    description: 'Lifetime access to all current and upcoming course modules',
  },
]

const CART_KEY = Symbol('sanvi.checkout.cart')

export interface CartStore {
  readonly items: OrderItem[]
  setItems(items: OrderItem[]): void
  clear(): void
  reset(): void
}

export function createCart(initialItems: OrderItem[] = DEFAULT_SAMPLE_ITEMS): CartStore {
  let items = $state<OrderItem[]>([...initialItems])

  return {
    get items() {
      return items
    },
    setItems(newItems: OrderItem[]) {
      items = [...newItems]
    },
    clear() {
      items = []
    },
    reset() {
      items = [...initialItems]
    },
  }
}

/**
 * SSR-safe: scopes the cart per request/component-tree via Svelte context.
 * Call once from the storefront's root `+layout.svelte`.
 */
export function setCartContext(cart: CartStore): CartStore {
  setContext(CART_KEY, cart)
  return cart
}

export function getCartContext(): CartStore | null {
  return hasContext(CART_KEY) ? (getContext(CART_KEY) as CartStore) : null
}

export function calculateCartTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.amount_minor * item.quantity, 0)
}
