import { v4 as uuidv4 } from 'uuid'
import OrderStatus from './OrderStatus'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, FulfillmentFailedError, PaymentUnvoidableError } from '../errors'

export interface StatusHistoryEntry {
  status: OrderStatus
  createdAt: Date
}

class Order {
  id: string
  clientId: string
  ticketIds: string[]
  statusHistory: StatusHistoryEntry[]

  constructor(clientId: string, ticketIds: string[]) {
    this.id = uuidv4()
    this.clientId = clientId
    this.ticketIds = ticketIds
    this.statusHistory = []
  }

  logStatus(status: OrderStatus): void {
    this.statusHistory.push({ status, createdAt: new Date() })
  }

  initialize(): void {
    this.logStatus(OrderStatus.Pending)
  }

  async fulfill(): Promise<void> {
    // Transfers tickets to client — calls ticketing service in production
  }

  async checkout(payment: PaymentMethod): Promise<OrderStatus> {
    try {
      await payment.authorize()
      this.logStatus(OrderStatus.PaymentAuthorized)
      await this.fulfill()
    } catch (e) {
      if (e instanceof PaymentDeclinedError) {
        this.logStatus(OrderStatus.PaymentDeclined)
        return OrderStatus.PaymentDeclined
      }
      if (e instanceof FulfillmentFailedError) {
        try {
          await payment.void()
          this.logStatus(OrderStatus.FulfillmentFailed)
          return OrderStatus.FulfillmentFailed
        } catch (voidError) {
          if (!(voidError instanceof PaymentUnvoidableError)) throw voidError
          this.logStatus(OrderStatus.NeedsAttention)
          return OrderStatus.NeedsAttention
        }
      }
      throw e
    }

    this.logStatus(OrderStatus.OrderComplete)
    return OrderStatus.OrderComplete
  }

  getStatus(): OrderStatus {
    return this.statusHistory.at(-1)?.status ?? OrderStatus.Pending
  }
}

export default Order
