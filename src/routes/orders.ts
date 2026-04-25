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
router.post('/', async (req: Request, res: Response) => {
  const result = CreateOrderBody.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: z.flattenError(result.error).fieldErrors })
  }

  const { clientId, ticketIds } = result.data
  const order = new Order(clientId.trim(), ticketIds)
  await db.createOrder(order)
  await order.initialize()

  return res.status(201).json({ orderId: order.id, status: await order.getStatus() })
})

// POST /orders/:orderId/checkout — Execute Transaction
router.post('/:orderId/checkout', async (req: Request, res: Response) => {
  const { orderId } = req.params

  const result = CheckoutBody.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: z.flattenError(result.error).fieldErrors })
  }

  const { paymentId } = result.data

  const claim = await db.claimCheckout(orderId)
  if (!claim.ok) {
    if (claim.reason === 'not_found') return res.status(404).json({ error: 'Order not found' })
    return res.status(409).json({ error: 'Order has already been processed or is currently being processed' })
  }

  const { order } = claim
  const payment = new PaymentMethod(order.clientId)
  const transaction = new Transaction(orderId, paymentId)

  try {
    const status = await order.checkout(payment)
    transaction.status = status
    await db.logTransaction(transaction)

    if (status === OrderStatus.NeedsAttention) {
      fireAlert(orderId)
    }

    const httpStatus = status === OrderStatus.Complete ? 200 : 422
    return res.status(httpStatus).json({ status, transactionId: transaction.id })
  } finally {
    await db.releaseCheckout(orderId)
  }
})

// GET /orders/:orderId/status — Get Order Status
router.get('/:orderId/status', async (req: Request, res: Response) => {
  const { orderId } = req.params
  const order = await db.getOrder(orderId)

  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  return res.json({
    orderId,
    status: await order.getStatus(),
    history: await order.getStatusHistory(),
  })
})

export default router
