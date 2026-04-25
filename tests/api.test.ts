import request from 'supertest'
import app from '../src/app'
import * as db from '../src/db'
import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, FulfillmentFailedError } from '../src/errors'

beforeEach(() => {
  db.clearAll()
  jest.restoreAllMocks()
  // Default: payment and fulfillment succeed
  jest.spyOn(PaymentMethod.prototype, 'authorize').mockResolvedValue()
  jest.spyOn(PaymentMethod.prototype, 'void').mockResolvedValue()
  jest.spyOn(Order.prototype, 'fulfill').mockResolvedValue()
})

// ─── POST /orders ──────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  test('creates order with valid params → 201 Pending', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    expect(res.status).toBe(201)
    expect(res.body.orderId).toBeDefined()
    expect(res.body.status).toBe(OrderStatus.Pending)
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

describe('POST /orders/:orderId/checkout — README validation test cases', () => {
  async function createOrder(): Promise<string> {
    const res = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })
    return res.body.orderId as string
  }

  test('valid order — payment authorized, fulfillment succeeds → OrderComplete', async () => {
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.OrderComplete)
    expect(res.body.transactionId).toBeDefined()
  })

  test('payment authorization fails → PaymentDeclined', async () => {
    jest.spyOn(PaymentMethod.prototype, 'authorize').mockRejectedValue(new PaymentDeclinedError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.PaymentDeclined)
  })

  test('fulfillment fails, void succeeds → FulfillmentFailed', async () => {
    jest.spyOn(Order.prototype, 'fulfill').mockRejectedValue(new FulfillmentFailedError())
    const orderId = await createOrder()

    const res = await request(app)
      .post(`/orders/${orderId}/checkout`)
      .send({ paymentId: 'pay-123' })

    expect(res.status).toBe(422)
    expect(res.body.status).toBe(OrderStatus.FulfillmentFailed)
  })

  test('fulfillment fails, void also fails → NeedsAttention', async () => {
    jest.spyOn(Order.prototype, 'fulfill').mockRejectedValue(new FulfillmentFailedError())
    jest.spyOn(PaymentMethod.prototype, 'void').mockRejectedValue(new Error('Void failed'))
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
    expect(res.body.status).toBe(OrderStatus.OrderComplete)
    expect(Array.isArray(res.body.history)).toBe(true)
    expect(res.body.history.length).toBeGreaterThan(0)
  })

  test('returns Pending before checkout', async () => {
    const createRes = await request(app)
      .post('/orders')
      .send({ clientId: 'client-1', ticketIds: ['ticket-1'] })

    const res = await request(app).get(`/orders/${createRes.body.orderId}/status`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe(OrderStatus.Pending)
  })

  test('unknown order → 404', async () => {
    const res = await request(app).get('/orders/nonexistent/status')
    expect(res.status).toBe(404)
  })
})
