import { Router, Request, Response } from 'express'
import { z } from 'zod'
import Order from '../models/Order'
import PaymentMethod from '../models/PaymentMethod'
import OrderStatus from '../models/OrderStatus'
import * as db from '../db'
import { InvalidTransitionError, CheckoutNotAllowedError, OrderNotInitializedError } from '../errors'

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

  const order = await db.getOrder(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const payment = new PaymentMethod(order.clientId)

  let status: OrderStatus
  try {
    status = await order.tryCheckout(payment, paymentId)
  } catch (e) {
    if (e instanceof CheckoutNotAllowedError) {
      return res.status(409).json({ status: e.currentStatus, error: e.message })
    }
    if (e instanceof InvalidTransitionError) {
      return res.status(409).json({ status: e.currentStatus, attemptedStatus: e.attemptedStatus })
    }
    if (e instanceof OrderNotInitializedError) {
      return res.status(404).json({ error: e.message })
    }
    throw e
  }

  const httpStatus = status === OrderStatus.Complete ? 200 : 422
  return res.status(httpStatus).json({ status })
})

// GET /orders/:orderId/status — Get Order Status
router.get('/:orderId/status', async (req: Request, res: Response) => {
  const { orderId } = req.params
  const order = await db.getOrder(orderId)

  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  try {
    return res.json({
      orderId,
      status: await order.getStatus(),
      history: await order.getStatusHistory(),
    })
  } catch (e) {
    if (e instanceof OrderNotInitializedError) {
      return res.status(404).json({ error: e.message })
    }
    throw e
  }
})

export default router
