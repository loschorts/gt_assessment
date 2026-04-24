// In-memory store — replace with a real DB in production.
// Transactions are the source of truth for order status; orders are indexed by ID.
import Order from './models/Order'
import Transaction from './models/Transaction'

const orders = new Map<string, Order>()
const transactions: Transaction[] = []

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
}
