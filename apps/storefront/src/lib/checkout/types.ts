import type { CheckoutView } from '@sanvi/api-client'

export interface OrderItem {
  id: string
  name: string
  quantity: number
  amount_minor: number
  description?: string
}

export interface OrderDetails {
  items: OrderItem[]
  currency: string
  reference: string
  subtotal_minor: number
  total_minor: number
}

export type CheckoutStatus =
  | 'idle'
  | 'initiating'
  | 'confirming'
  | 'paid'
  | 'delayed'
  | 'failed'
  | 'canceled'

export type { CheckoutView }
