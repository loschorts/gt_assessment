import { v4 as uuidv4 } from 'uuid'
import OrderStatus, { assertTransition } from './OrderStatus'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError, OrderNotInitializedError } from '../errors'
import { getDb } from '../database'
// Circular import with db.ts is intentional and safe: both modules only reference
// each other inside function bodies, so CommonJS resolves both before any function runs.
import * as db from '../db'
import { throwIfSimulated } from '../simulation'
import { fireAlert } from '../alerts'

export interface StatusHistoryEntry {
  status: OrderStatus
  createdAt: Date
}

class Order {
  id: string
  clientId: string
  ticketIds: string[]
  paymentId: string | null

  constructor(clientId: string, ticketIds: string[]) {
    this.id = uuidv4()
    this.clientId = clientId
    this.ticketIds = ticketIds
    this.paymentId = null
  }

  private async logStatus(status: OrderStatus): Promise<void> {
    const sqliteDb = await getDb()
    await sqliteDb.run(
      'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
      this.id, status
    )
  }

  async initialize(): Promise<void> {
    await db.createOrder(this)
    await this.logStatus(OrderStatus.Initialized)
  }

  async getStatus(): Promise<OrderStatus> {
    const sqliteDb = await getDb()
    const row = await sqliteDb.get<{ status: string }>(
      'SELECT status FROM order_status_history WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      this.id
    )
    if (!row) throw new OrderNotInitializedError()
    return row.status as OrderStatus
  }

  async getStatusHistory(): Promise<StatusHistoryEntry[]> {
    const sqliteDb = await getDb()
    const rows = await sqliteDb.all<{ status: string; created_at: string }[]>(
      'SELECT status, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
      this.id
    )
    return rows.map(r => ({ status: r.status as OrderStatus, createdAt: new Date(r.created_at) }))
  }

  async tryComplete(): Promise<void> {
    throwIfSimulated(CompletionFailedError)
  }

  private async transition(current: OrderStatus, next: OrderStatus): Promise<OrderStatus> {
    assertTransition(current, next)
    await this.logStatus(next)
    return next
  }

  async tryCheckout(payment: PaymentMethod, paymentId: string): Promise<OrderStatus> {
    let currentStatus = await this.getStatus()
    assertTransition(currentStatus, OrderStatus.PaymentAuthorized)

    this.paymentId = paymentId
    await db.savePaymentId(this.id, paymentId)

    try {
      await payment.authorize()
      currentStatus = await this.transition(currentStatus, OrderStatus.PaymentAuthorized)
      await this.tryComplete()
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        return this.transition(currentStatus, OrderStatus.PaymentDeclined)
      }
      if (e instanceof CompletionFailedError) {
        try {
          await payment.void()
          return this.transition(currentStatus, OrderStatus.Cancelled)
        } catch (voidError) {
          const status = await this.transition(currentStatus, OrderStatus.NeedsAttention)
          fireAlert(this.id)
          if (!(voidError instanceof PaymentUnvoidableError)) throw voidError
          return status
        }
      }
      throw e
    }

    return this.transition(currentStatus, OrderStatus.Complete)
  }
}

export default Order
