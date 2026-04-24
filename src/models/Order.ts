import { v4 as uuidv4 } from 'uuid'
import Status from './Status'
import PaymentMethod from './PaymentMethod'
import { PaymentDeclinedError, FulfillmentFailedError } from '../errors'

export interface StatusHistoryEntry {
  status: Status
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

  logStatus(status: Status): void {
    this.statusHistory.push({ status, createdAt: new Date() })
  }

  initialize(): void {
    this.logStatus(Status.Pending)
  }

  fulfill(): void {
    // Transfers tickets to client — calls ticketing service in production
  }

  checkout(payment: PaymentMethod): Status {
    if (this.processing) {
      throw new Error('Order is already being processed')
    }
    this.processing = true

    try {
      try {
        payment.authorize()
        this.logStatus(Status.PaymentAuthorized)
        this.fulfill()
      } catch (e) {
        if (e instanceof PaymentDeclinedError) {
          this.logStatus(Status.PaymentDeclined)
          return Status.PaymentDeclined
        }
        if (e instanceof FulfillmentFailedError) {
          try {
            payment.void()
            this.logStatus(Status.FulfillmentFailed)
            return Status.FulfillmentFailed
          } catch {
            this.logStatus(Status.NeedsAttention)
            return Status.NeedsAttention
          }
        }
        throw e
      }

      this.logStatus(Status.OrderComplete)
      return Status.OrderComplete
    } finally {
      this.processing = false
    }
  }

  getStatus(): Status {
    return this.statusHistory.at(-1)?.status ?? Status.Pending
  }
}

export default Order
