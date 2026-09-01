import type { OrderItem } from './types'

const DEFAULT_SAMPLE_ITEMS: OrderItem[] = [
  {
    id: 'item-foundations-course',
    name: 'Full Platform Access & Foundations Course',
    quantity: 1,
    amount_minor: 4800,
    description: 'Lifetime access to all current and upcoming course modules',
  },
]

let cartItemsState = $state<OrderItem[]>([...DEFAULT_SAMPLE_ITEMS])

export function getCartItems(): OrderItem[] {
  return cartItemsState
}

export function setCartItems(items: OrderItem[]): void {
  cartItemsState = [...items]
}

export function resetCart(): void {
  cartItemsState = [...DEFAULT_SAMPLE_ITEMS]
}

export function clearCart(): void {
  cartItemsState = []
}

export function calculateCartTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.amount_minor * item.quantity, 0)
}
