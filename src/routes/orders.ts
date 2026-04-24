import { Router, Request, Response } from 'express'
import Order from '../models/Order'
import PaymentMethod from '../models/PaymentMethod'
import Transaction from '../models/Transaction'
import Status from '../models/Status'
import * as db from '../db'
import { fireAlert } from '../alerts'

const router = Router()

// POST /orders — Initialize Order
router.post('/', (req: Request, res: Response) => {
  const { clientId, ticketIds } = req.body

  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    return res.status(400).json({ error: 'clientId is required' })
  }
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ error: 'ticketIds must be a non-empty array' })
  }

  const order = new Order(clientId.trim(), ticketIds as string[])
  order.initialize()
  db.createOrder(order)

  return res.status(201).json({ orderId: order.id, status: order.getStatus() })
})

// POST /orders/:orderId/checkout — Execute Transaction
router.post('/:orderId/checkout', (req: Request, res: Response) => {
  const { orderId } = req.params
  const { paymentId } = req.body

  const order = db.getOrder(orderId)
  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  if (!paymentId || typeof paymentId !== 'string') {
    return res.status(400).json({ error: 'paymentId is required' })
  }

  const currentStatus = order.getStatus()
  if (currentStatus !== Status.Pending) {
    return res.status(409).json({ error: 'Order has already been processed', status: currentStatus })
  }

  const payment = new PaymentMethod(order.clientId)
  const transaction = new Transaction(orderId, paymentId)

  const status = order.checkout(payment)
  transaction.status = status
  db.logTransaction(transaction)

  if (status === Status.NeedsAttention) {
    fireAlert(orderId)
  }

  const httpStatus = status === Status.OrderComplete ? 200 : 422
  return res.status(httpStatus).json({ status, transactionId: transaction.id })
})

// GET /orders/:orderId/status — Get Order Status
router.get('/:orderId/status', (req: Request, res: Response) => {
  const { orderId } = req.params
  const order = db.getOrder(orderId)

  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  return res.json({
    orderId,
    status: order.getStatus(),
    history: order.statusHistory,
  })
})

export default router
