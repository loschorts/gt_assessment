import { v4 as uuidv4 } from 'uuid'
import OrderStatus from './OrderStatus'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError } from '../errors'
import { getDb } from '../database'
// Circular import with db.ts is intentional and safe: both modules only reference
// each other inside function bodies, so CommonJS resolves both before any function runs.
import * as db from '../db'
import { throwIfSimulated } from '../simulation'

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

  async logStatus(status: OrderStatus): Promise<void> {
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
    return (row?.status as OrderStatus) ?? OrderStatus.Uninitialized
  }

  async getStatusHistory(): Promise<StatusHistoryEntry[]> {
    const sqliteDb = await getDb()
    const rows = await sqliteDb.all<{ status: string; created_at: string }[]>(
      'SELECT status, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
      this.id
    )
    return rows.map(r => ({ status: r.status as OrderStatus, createdAt: new Date(r.created_at) }))
  }

  async complete(): Promise<void> {
    throwIfSimulated('CompletionFailedError')
  }

  async checkout(payment: PaymentMethod, paymentId: string): Promise<OrderStatus> {
    this.paymentId = paymentId
    await db.savePaymentId(this.id, paymentId)

    try {
      await payment.authorize()
      await this.complete()
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        await this.logStatus(OrderStatus.PaymentDeclined)
        return OrderStatus.PaymentDeclined
      }
      if (e instanceof CompletionFailedError) {
        try {
          await payment.void()
          await this.logStatus(OrderStatus.Cancelled)
          return OrderStatus.Cancelled
        } catch (voidError) {
          if (!(voidError instanceof PaymentUnvoidableError)) throw voidError
          await this.logStatus(OrderStatus.NeedsAttention)
          return OrderStatus.NeedsAttention
        }
      }
      throw e
    }

    await this.logStatus(OrderStatus.Complete)
    return OrderStatus.Complete
  }
}

export default Order
