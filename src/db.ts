import Order from './models/Order'
import { getDb } from './database'

export async function createOrder(order: Order): Promise<Order> {
  const db = await getDb()
  await db.run(
    'INSERT INTO orders (id, client_id, ticket_ids, payment_id) VALUES (?, ?, ?, ?)',
    order.id, order.clientId, JSON.stringify(order.ticketIds), order.paymentId
  )
  return order
}

export async function savePaymentId(orderId: string, paymentId: string): Promise<void> {
  const db = await getDb()
  await db.run('UPDATE orders SET payment_id = ? WHERE id = ?', paymentId, orderId)
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = await getDb()
  const row = await db.get<{ id: string; client_id: string; ticket_ids: string; payment_id: string | null }>(
    'SELECT id, client_id, ticket_ids, payment_id FROM orders WHERE id = ?',
    id
  )
  if (!row) return null
  const order = new Order(row.client_id, JSON.parse(row.ticket_ids))
  order.id = row.id
  order.paymentId = row.payment_id
  return order
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  await db.run('DELETE FROM order_status_history')
  await db.run('DELETE FROM orders')
}
