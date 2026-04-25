import { v4 as uuidv4 } from 'uuid'
import OrderStatus from './OrderStatus'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, FulfillmentFailedError, PaymentUnvoidableError } from '../errors'
import { getDb } from '../database'

export interface StatusHistoryEntry {
  status: OrderStatus
  createdAt: Date
}

class Order {
  id: string
  clientId: string
  ticketIds: string[]

  constructor(clientId: string, ticketIds: string[]) {
    this.id = uuidv4()
    this.clientId = clientId
    this.ticketIds = ticketIds
  }

  async logStatus(status: OrderStatus): Promise<void> {
    const db = await getDb()
    await db.run(
      'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
      this.id, status
    )
  }

  async initialize(): Promise<void> {
    await this.logStatus(OrderStatus.Initialized)
  }

  async getStatus(): Promise<OrderStatus> {
    const db = await getDb()
    const row = await db.get<{ status: string }>(
      'SELECT status FROM order_status_history WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      this.id
    )
    return (row?.status as OrderStatus) ?? OrderStatus.Uninitialized
  }

  async getStatusHistory(): Promise<StatusHistoryEntry[]> {
    const db = await getDb()
    const rows = await db.all<{ status: string; created_at: string }[]>(
      'SELECT status, created_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
      this.id
    )
    return rows.map(r => ({ status: r.status as OrderStatus, createdAt: new Date(r.created_at) }))
  }

  async fulfill(): Promise<void> {
    // Transfers tickets to client — calls ticketing service in production
  }

  async checkout(payment: PaymentMethod): Promise<OrderStatus> {
    try {
      await payment.authorize()
      await this.logStatus(OrderStatus.PaymentAuthorized)
      await this.fulfill()
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        await this.logStatus(OrderStatus.PaymentDeclined)
        return OrderStatus.PaymentDeclined
      }
      if (e instanceof FulfillmentFailedError) {
        try {
          await payment.void()
          await this.logStatus(OrderStatus.FulfillmentFailed)
          return OrderStatus.FulfillmentFailed
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
