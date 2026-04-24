import { v4 as uuidv4 } from 'uuid'
import Status from './Status'

class Transaction {
  id: string
  orderId: string
  paymentId: string
  status: Status | null
  createdAt: Date

  constructor(orderId: string, paymentId: string) {
    this.id = uuidv4()
    this.orderId = orderId
    this.paymentId = paymentId
    this.status = null
    this.createdAt = new Date()
  }
}

export default Transaction
