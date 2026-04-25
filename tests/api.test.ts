import request from 'supertest'
import app from '../src/app'
import * as db from '../src/db'
import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError } from '../src/errors'

beforeEach(async () => {
  await db.clearAll()
  jest.restoreAllMocks()
  // Default: payment and fulfillment succeed
  jest.spyOn(PaymentMethod.prototype, 'authorize').mockResolvedValue()
  jest.spyOn(PaymentMethod.prototype, 'void').mockResolvedValue()
  jest.spyOn(Order.prototype, 'tryComplete').mockResolvedValue()
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

  test('re-checkout already-processed order → 409', async () => {
    const orderId = await createOrder()
    await request(app).post(`/orders/${orderId}/checkout`).send({ paymentId: 'pay-1' })

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-2' })

    expect(res.status).toBe(409)
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
})
