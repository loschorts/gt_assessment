import * as db from '../src/db'
import Order from '../src/models/Order'
import OrderStatus from '../src/models/OrderStatus'

function makeOrder(): Order {
  const order = new Order('client-1', ['ticket-1'])
  order.initialize()
  db.createOrder(order)
  return order
}

beforeEach(() => db.clearAll())

describe('claimCheckout()', () => {
  test('succeeds for a Pending order', () => {
    const order = makeOrder()
    const result = db.claimCheckout(order.id)
    expect(result).toEqual({ ok: true, order })
  })

  test('returns not_found for an unknown order ID', () => {
    const result = db.claimCheckout('nonexistent')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  test('returns conflict when the order is already locked', () => {
    const order = makeOrder()
    db.claimCheckout(order.id)

    const second = db.claimCheckout(order.id)
    expect(second).toEqual({ ok: false, reason: 'conflict' })
  })

  test('returns conflict when the order is no longer Pending', () => {
    const order = makeOrder()
    order.logStatus(OrderStatus.OrderComplete)

    const result = db.claimCheckout(order.id)
    expect(result).toEqual({ ok: false, reason: 'conflict' })
  })
})

describe('releaseCheckout()', () => {
  test('allows a second claim after the lock is released', () => {
    const order = makeOrder()
    db.claimCheckout(order.id)
    db.releaseCheckout(order.id)

    const result = db.claimCheckout(order.id)
    expect(result).toEqual({ ok: true, order })
  })

  test('is a no-op for an order that was never locked', () => {
    const order = makeOrder()
    expect(() => db.releaseCheckout(order.id)).not.toThrow()
  })
})

describe('clearAll()', () => {
  test('clears active locks so orders can be claimed again', () => {
    const order = makeOrder()
    db.claimCheckout(order.id)

    db.clearAll()
    db.createOrder(order)
    order.statusHistory = [{ status: OrderStatus.Pending, createdAt: new Date() }]

    const result = db.claimCheckout(order.id)
    expect(result.ok).toBe(true)
  })
})
