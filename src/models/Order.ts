import { v4 as uuidv4 } from 'uuid'
import OrderStatus from './OrderStatus'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, FulfillmentFailedError } from '../errors'

export interface StatusHistoryEntry {
  status: OrderStatus
  createdAt: Date
}

class Order {
  id: string
  clientId: string
  ticketIds: string[]
  processing: boolean
  statusHistory: StatusHistoryEntry[]

  constructor(clientId: string, ticketIds: string[]) {
    this.id = uuidv4()
    this.clientId = clientId
    this.ticketIds = ticketIds
    this.processing = false
    this.statusHistory = []
  }

  logStatus(status: OrderStatus): void {
    this.statusHistory.push({ status, createdAt: new Date() })
  }

  initialize(): void {
    this.logStatus(OrderStatus.Pending)
  }

  fulfill(): void {
    // Transfers tickets to client — calls ticketing service in production
  }

  checkout(payment: PaymentMethod): OrderStatus {
    if (this.processing) {
      throw new Error('Order is already being processed')
    }
    this.processing = true

    try {
      try {
        payment.authorize()
        this.logStatus(OrderStatus.PaymentAuthorized)
        this.fulfill()
      } catch (e) {
        if (e instanceof PaymentDeclinedError) {
          this.logStatus(OrderStatus.PaymentDeclined)
          return OrderStatus.PaymentDeclined
        }
        if (e instanceof FulfillmentFailedError) {
          try {
            payment.void()
            this.logStatus(OrderStatus.FulfillmentFailed)
            return OrderStatus.FulfillmentFailed
          } catch {
            this.logStatus(OrderStatus.NeedsAttention)
            return OrderStatus.NeedsAttention
          }
        }
        throw e
      }

      this.logStatus(OrderStatus.OrderComplete)
      return OrderStatus.OrderComplete
    } finally {
      this.processing = false
    }
  }

  getStatus(): OrderStatus {
    return this.statusHistory.at(-1)?.status ?? OrderStatus.Pending
  }
}

export default Order
