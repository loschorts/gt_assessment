enum OrderStatus {
  Initialized = 'Initialized',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  Cancelled = 'Cancelled',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

const TERMINAL: OrderStatus[] = []

const CHECKOUT_OUTCOMES: OrderStatus[] = [
  OrderStatus.PaymentDeclined,
  OrderStatus.Cancelled,
  OrderStatus.NeedsAttention,
  OrderStatus.Complete,
]

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Initialized]:       CHECKOUT_OUTCOMES,
  [OrderStatus.PaymentAuthorized]: CHECKOUT_OUTCOMES,
  [OrderStatus.PaymentDeclined]:   CHECKOUT_OUTCOMES,
  [OrderStatus.Cancelled]:       CHECKOUT_OUTCOMES,
  [OrderStatus.NeedsAttention]:  TERMINAL,
  [OrderStatus.Complete]:        TERMINAL,
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export default OrderStatus
