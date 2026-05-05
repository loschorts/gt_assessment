import request from 'supertest'
import app from '../src/app'
import * as db from '../src/db'
import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError, InventoryNotAvailableError } from '../src/errors'
import * as alerts from '../src/alerts'

beforeEach(async () => {
  await db.clearAll()
  jest.restoreAllMocks()
  // Default: payment and fulfillment succeed
  jest.spyOn(PaymentMethod.prototype, 'authorize').mockResolvedValue()
  jest.spyOn(PaymentMethod.prototype, 'void').mockResolvedValue()
  jest.spyOn(Order.prototype, 'checkInventory').mockResolvedValue()
  jest.spyOn(Order.prototype, 'tryComplete').mockResolvedValue()
  jest.spyOn(alerts, 'fireAlert').mockImplementation(() => {})
})

// ─── POST /orders ──────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  test('creates order with valid params → 201 Initialized', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    expect(res.status).toBe(201)
    expect(res.body.orderId).toBeDefined()
    expect(res.body.status).toBe(OrderStatus.Initialized)
  })

  test('invalid order — missing clientId → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ ticketIds: ['ticket-1'] })

    expect(res.status).toBe(400)
  })

  test('invalid order — empty ticketIds → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: [] })

    expect(res.status).toBe(400)
  })

  test('invalid order — ticketIds not an array → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: 'ticket-1' })

    expect(res.status).toBe(400)
  })
})

// ─── POST /orders/:orderId/checkout ───────────────────────────────────────────

describe('POST /orders/:orderId/checkout — order creation and state transition behavior', () => {
  async function createOrder(): Promise<string> {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    return res.body.orderId as string
  }

  test('valid order — payment authorized, fulfillment succeeds → Complete', async () => {
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.Complete)

  })

  test('payment authorization fails → PaymentDeclined, completion not attempted', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const completeSpy = jest.spyOn(Order.prototype, 'tryComplete')
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
    expect(completeSpy).not.toHaveBeenCalled()
  })

  test('payment declined even when completion would also fail → PaymentDeclined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
  })

  test('payment declined even when void would also fail → PaymentDeclined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
  })

  test('payment declined even when both completion and void would fail → PaymentDeclined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
  })

  test('completion fails, void succeeds → Cancelled', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.Cancelled)
  })

  test('completion fails, void also fails → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.NeedsAttention)
  })

  test('unknown order → 404', async () => {
    const res = await request(app)
      .post('/orders/nonexistent/checkout')
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(404)
  })

  test('missing paymentId → 400', async () => {
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({})

    expect(res.status).toBe(400)
  })

  test('re-checkout Complete order → 409 with current status, no attemptedStatus', async () => {
    const orderId = await createOrder()
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-1' })

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-2' })

    expect(res.status).toBe(409)
    expect(res.body.status).toBe(OrderStatus.Complete)
    expect(res.body.attemptedStatus).toBeUndefined()
  })

  test('re-checkout after PaymentDeclined → allowed, not 409', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValueOnce(new PaymentDeclinedError())
    const orderId = await createOrder()
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-1' })

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-2' })

    expect(res.status).not.toBe(409)
  })

  test('re-checkout after Cancelled → allowed, not 409', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValueOnce(new CompletionFailedError())
    const orderId = await createOrder()
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-1' })

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-2' })

    expect(res.status).not.toBe(409)
  })

  test('re-checkout after NeedsAttention → 409 with current status, no attemptedStatus', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValueOnce(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValueOnce(new PaymentUnvoidableError())
    const orderId = await createOrder()
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-1' })

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-2' })

    expect(res.status).toBe(409)
    expect(res.body.status).toBe(OrderStatus.NeedsAttention)
    expect(res.body.attemptedStatus).toBeUndefined()
  })

  test('calls tryComplete when authorize succeeds', async () => {
    const completeSpy = jest.spyOn(Order.prototype, 'tryComplete')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(completeSpy).toHaveBeenCalledTimes(1)
  })

  test('calls void when completion fails', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const voidSpy = jest.spyOn(PaymentMethod.prototype, 'void')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(voidSpy).toHaveBeenCalledTimes(1)
  })

  test('does not call void when payment is declined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const voidSpy = jest.spyOn(PaymentMethod.prototype, 'void')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(voidSpy).not.toHaveBeenCalled()
  })

  test('fires alert when completion fails and void also fails → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const alertSpy = jest.spyOn(alerts, 'fireAlert')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(orderId)
  })

  test('does not fire alert on success', async () => {
    const alertSpy = jest.spyOn(alerts, 'fireAlert')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(alertSpy).not.toHaveBeenCalled()
  })

  test('does not fire alert when payment is declined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const alertSpy = jest.spyOn(alerts, 'fireAlert')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(alertSpy).not.toHaveBeenCalled()
  })

  test('does not fire alert when completion fails but void succeeds → Cancelled', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const alertSpy = jest.spyOn(alerts, 'fireAlert')
    const orderId = await createOrder()

    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(alertSpy).not.toHaveBeenCalled()
  })
})

// ─── GET /orders/:orderId/status ───────────────────────────────────────────────

describe('GET /orders/:orderId/status', () => {
  test('returns current status and full history after checkout', async () => {
    const createRes = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    const orderId = createRes.body.orderId as string

    await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)

    expect(res.status).toBe(200)
    expect(res.body.orderId).toBe(orderId)
    expect(res.body.status).toBe(OrderStatus.Complete)
    expect(Array.isArray(res.body.history)).toBe(true)
    expect(res.body.history.length).toBeGreaterThan(0)
  })

  test('returns Initialized before checkout', async () => {
    const createRes = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    const res = await request(app).get(`/orders/${createRes.body.orderId}/status`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.Initialized)
  })

  test('unknown order → 404', async () => {
    const res = await request(app).get('/orders/nonexistent/status')
    expect(res.status).toBe(404)
  })

  test('returns PaymentDeclined after payment failure', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
  })

  test('returns Cancelled after completion failure', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.Cancelled)
  })

  test('returns NeedsAttention after void failure', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.NeedsAttention)
  })

  test('history entries have status and createdAt fields', async () => {
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    res.body.history.forEach((entry: { status: unknown; createdAt: unknown }) => {
      expect(entry.status).toBeDefined()
      expect(entry.createdAt).toBeDefined()
    })
  })

  test('history sequence on success: Initialized → PaymentAuthorized → CheckingInventory → Complete', async () => {
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentAuthorized, OrderStatus.CheckingInventory, OrderStatus.Complete,
    ])
  })

  test('history sequence on payment declined: Initialized → PaymentDeclined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentDeclined,
    ])
  })

  test('history sequence on Cancelled (completion fails): Initialized → PaymentAuthorized → CheckingInventory → Cancelled', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentAuthorized, OrderStatus.CheckingInventory, OrderStatus.Cancelled,
    ])
  })

  test('history sequence on NeedsAttention (completion fails): Initialized → PaymentAuthorized → CheckingInventory → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'tryComplete').mockRejectedValue(new CompletionFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentAuthorized, OrderStatus.CheckingInventory, OrderStatus.NeedsAttention,
    ])
  })

  test('inventory unavailable, void succeeds → Cancelled', async () => {
    jest.spyOn(Order.prototype, 'checkInventory').mockRejectedValue(new InventoryNotAvailableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    const res = await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.Cancelled)
  })

  test('history sequence on Cancelled (inventory unavailable): Initialized → PaymentAuthorized → CheckingInventory → InventoryNotAvailable → Cancelled', async () => {
    jest.spyOn(Order.prototype, 'checkInventory').mockRejectedValue(new InventoryNotAvailableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentAuthorized, OrderStatus.CheckingInventory, OrderStatus.InventoryNotAvailable, OrderStatus.Cancelled,
    ])
  })

  test('inventory unavailable, void also fails → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'checkInventory').mockRejectedValue(new InventoryNotAvailableError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    const res = await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.NeedsAttention)
  })

  test('history sequence on NeedsAttention (inventory unavailable): Initialized → PaymentAuthorized → CheckingInventory → InventoryNotAvailable → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'checkInventory').mockRejectedValue(new InventoryNotAvailableError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new PaymentUnvoidableError())
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    expect(res.body.history.map((e: { status: string }) => e.status)).toEqual([
      OrderStatus.Initialized, OrderStatus.PaymentAuthorized, OrderStatus.CheckingInventory, OrderStatus.InventoryNotAvailable, OrderStatus.NeedsAttention,
    ])
  })

  test('history timestamps are chronologically non-decreasing', async () => {
    const { body: { orderId } } = await request(app).post('/orders').send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-123' })

    const res = await request(app).get(`/orders/${orderId}/status`)
    const timestamps = res.body.history.map((e: { createdAt: string }) => new Date(e.createdAt).getTime())
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
    }
  })
})
