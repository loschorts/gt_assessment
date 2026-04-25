import Order from './models/Order'
import OrderStatus from './models/OrderStatus'
import Transaction from './models/Transaction'
import { getDb } from './database'

export type ClaimCheckoutResult =
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'conflict' }

// Atomically checks that the order exists, is Initialized, and is not already locked,
// then claims the lock via a single INSERT ... SELECT statement (atomic in SQLite).
//
// The lock row persists until releaseCheckout() is called explicitly. In production
// you would add a TTL column and a background reaper (or use a DB-native advisory
// lock with automatic release on connection drop), but that complexity is out of
// scope for this assessment.
export async function claimCheckout(orderId: string): Promise<ClaimCheckoutResult> {
  const db = await getDb()

  const result = await db.run(
    `INSERT INTO checkout_locks (order_id)
     SELECT o.id FROM orders o
     WHERE o.id = ?
       AND (
         SELECT osh.status FROM order_status_history osh
         WHERE osh.order_id = o.id
         ORDER BY osh.id DESC LIMIT 1
       ) = ?
       AND NOT EXISTS (
         SELECT 1 FROM checkout_locks cl WHERE cl.order_id = o.id
       )`,
    orderId, OrderStatus.Initialized
  )

  if ((result.changes ?? 0) === 0) {
    const orderRow = await db.get('SELECT id FROM orders WHERE id = ?', orderId)
    if (!orderRow) return { ok: false, reason: 'not_found' }
    return { ok: false, reason: 'conflict' }
  }

  const row = await db.get<{ id: string; client_id: string; ticket_ids: string }>(
    'SELECT id, client_id, ticket_ids FROM orders WHERE id = ?',
    orderId
  )
  const order = new Order(row!.client_id, JSON.parse(row!.ticket_ids))
  order.id = row!.id
  return { ok: true, order }
}

export async function releaseCheckout(orderId: string): Promise<void> {
  const db = await getDb()
  await db.run('DELETE FROM checkout_locks WHERE order_id = ?', orderId)
}

export async function createOrder(order: Order): Promise<Order> {
  const db = await getDb()
  await db.run(
    'INSERT INTO orders (id, client_id, ticket_ids) VALUES (?, ?, ?)',
    order.id, order.clientId, JSON.stringify(order.ticketIds)
  )
  return order
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = await getDb()
  const row = await db.get<{ id: string; client_id: string; ticket_ids: string }>(
    'SELECT id, client_id, ticket_ids FROM orders WHERE id = ?',
    id
  )
  if (!row) return null
  const order = new Order(row.client_id, JSON.parse(row.ticket_ids))
  order.id = row.id
  return order
}

export async function logTransaction(transaction: Transaction): Promise<Transaction> {
  const db = await getDb()
  await db.run(
    'INSERT INTO transactions (id, order_id, payment_id, status) VALUES (?, ?, ?, ?)',
    transaction.id, transaction.orderId, transaction.paymentId, transaction.status
  )
  return transaction
}

export async function getTransactions(orderId: string): Promise<Transaction[]> {
  const db = await getDb()
  const rows = await db.all<{ id: string; order_id: string; payment_id: string; status: string }[]>(
    'SELECT id, order_id, payment_id, status FROM transactions WHERE order_id = ?',
    orderId
  )
  return rows.map(r => {
    const t = new Transaction(r.order_id, r.payment_id)
    t.id = r.id
    t.status = r.status as OrderStatus
    return t
  })
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  // Delete in dependency order (checkout_locks and transactions reference orders)
  await db.run('DELETE FROM checkout_locks')
  await db.run('DELETE FROM transactions')
  await db.run('DELETE FROM order_status_history')
  await db.run('DELETE FROM orders')
}
