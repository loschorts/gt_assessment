import { Router, Request, Response } from 'express'
import { z } from 'zod'
import Order from '../models/Order'
import PaymentMethod from '../models/PaymentMethod'
import Transaction from '../models/Transaction'
import OrderStatus from '../models/OrderStatus'
import * as db from '../db'
import { fireAlert } from '../alerts'

const router = Router()

const CreateOrderBody = z.object({
  clientId: z.string().min(1),
  ticketIds: z.array(z.string()).min(1),
})

const CheckoutBody = z.object({
  paymentId: z.string().min(1),
})

// POST /orders — Initialize Order
router.post('/', (req: Request, res: Response) => {
  const result = CreateOrderBody.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: z.flattenError(result.error).fieldErrors })
  }

  const { clientId, ticketIds } = result.data
  const order = new Order(clientId.trim(), ticketIds)
  order.initialize()
  db.createOrder(order)

  return res.status(201).json({ orderId: order.id, status: order.getStatus() })
})

// POST /orders/:orderId/checkout — Execute Transaction
router.post('/:orderId/checkout', async (req: Request, res: Response) => {
  const { orderId } = req.params

  const result = CheckoutBody.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: z.flattenError(result.error).fieldErrors })
  }

  const { paymentId } = result.data

  const order = db.getOrder(orderId)
  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  const currentStatus = order.getStatus()
  if (currentStatus !== OrderStatus.Pending) {
    return res.status(409).json({ error: 'Order has already been processed', status: currentStatus })
  }

  const payment = new PaymentMethod(order.clientId)
  const transaction = new Transaction(orderId, paymentId)

  const status = await order.checkout(payment)
  transaction.status = status
  db.logTransaction(transaction)

  if (status === OrderStatus.NeedsAttention) {
    fireAlert(orderId)
  }

  const httpStatus = status === OrderStatus.OrderComplete ? 200 : 422
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
