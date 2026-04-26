import { InvalidTransitionError, CheckoutNotAllowedError } from '../errors'

enum OrderStatus {
  Initialized = 'Initialized',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  Cancelled = 'Cancelled',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

// States from which checkout may be initiated. Must stay in sync with CHECKOUT_START:
// every state here must have PaymentAuthorized as a valid next state.
const CHECKOUT_ALLOWED = new Set([
  OrderStatus.Initialized,
  OrderStatus.PaymentDeclined,
  OrderStatus.Cancelled,
])

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
  [OrderStatus.NeedsAttention]:    [],
  [OrderStatus.Complete]:          [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export function assertCheckoutAllowed(status: OrderStatus): void {
  if (!CHECKOUT_ALLOWED.has(status)) throw new CheckoutNotAllowedError(status)
}

export default OrderStatus
