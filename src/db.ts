// In-memory store — replace with a real DB in production.
// Transactions are the source of truth for order status; orders are indexed by ID.
import Order from './models/Order'
import OrderStatus from './models/OrderStatus'
import Transaction from './models/Transaction'

const orders = new Map<string, Order>()
const transactions: Transaction[] = []
// Simulates a DB-level row lock — in production this would be a compare-and-swap
// (e.g. UPDATE orders SET locked = TRUE WHERE id = ? AND status = 'Pending' AND locked = FALSE).
const checkoutLocks = new Set<string>()

export type ClaimCheckoutResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'conflict' }

// Atomically checks that the order exists, is Pending, and is not already locked,
// then claims the lock. Returns conflict if the order is mid-checkout or already processed.
export function claimCheckout(orderId: string): ClaimCheckoutResult {
  const order = orders.get(orderId)
  if (!order) return { ok: false, reason: 'not_found' }
  if (order.getStatus() !== OrderStatus.Pending || checkoutLocks.has(orderId)) {
    return { ok: false, reason: 'conflict' }
  }
  checkoutLocks.add(orderId)
  return { ok: true, order }
}

export function releaseCheckout(orderId: string): void {
  checkoutLocks.delete(orderId)
}

export function createOrder(order: Order): Order {
  orders.set(order.id, order)
  return order
}

export function getOrder(id: string): Order | null {
  return orders.get(id) ?? null
}

export function logTransaction(transaction: Transaction): Transaction {
  transactions.push(transaction)
  return transaction
}

export function getTransactions(orderId: string): Transaction[] {
  return transactions.filter(t => t.orderId === orderId)
}

export function clearAll(): void {
  orders.clear()
  transactions.length = 0
  checkoutLocks.clear()
}
