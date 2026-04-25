import { InvalidTransitionError } from '../errors'

enum OrderStatus {
  Initialized = 'Initialized',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  Cancelled = 'Cancelled',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

const TERMINAL: OrderStatus[] = []

// States reachable on checkout entry: authorize succeeds or fails
const CHECKOUT_START: OrderStatus[] = [
  OrderStatus.PaymentAuthorized,
  OrderStatus.PaymentDeclined,
]

// States reachable once payment is authorized: completion outcomes
const CHECKOUT_OUTCOMES: OrderStatus[] = [
  OrderStatus.Complete,
  OrderStatus.Cancelled,
  OrderStatus.NeedsAttention,
]

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Initialized]:       CHECKOUT_START,
  [OrderStatus.PaymentAuthorized]: CHECKOUT_OUTCOMES,
  [OrderStatus.PaymentDeclined]:   CHECKOUT_START,
  [OrderStatus.Cancelled]:         CHECKOUT_START,
  [OrderStatus.NeedsAttention]:    TERMINAL,
  [OrderStatus.Complete]:          TERMINAL,
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from)
}

export default OrderStatus
