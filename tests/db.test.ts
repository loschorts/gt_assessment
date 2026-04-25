import * as db from '../src/db'
import Order from '../src/models/Order'
import OrderStatus from '../src/models/OrderStatus'

async function makeOrder(): Promise<Order> {
  const order = new Order('client-1', ['ticket-1'])
  await order.initialize()
  return order
}

beforeEach(async () => db.clearAll())

describe('claimCheckout()', () => {
  test('succeeds for an Initialized order', async () => {
    const order = await makeOrder()
    const result = await db.claimCheckout(order.id)
    expect(result).toEqual({ ok: true, order })
  })

  test('returns not_found for an unknown order ID', async () => {
    const result = await db.claimCheckout('nonexistent')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  test('returns conflict when the order is already locked', async () => {
    const order = await makeOrder()
    await db.claimCheckout(order.id)

    const second = await db.claimCheckout(order.id)
    expect(second).toEqual({ ok: false, reason: 'conflict' })
  })

  test('returns conflict when the order is no longer Initialized', async () => {
    const order = await makeOrder()
    await order.logStatus(OrderStatus.Complete)

    const result = await db.claimCheckout(order.id)
    expect(result).toEqual({ ok: false, reason: 'conflict' })
  })
})

describe('releaseCheckout()', () => {
  test('allows a second claim after the lock is released', async () => {
    const order = await makeOrder()
    await db.claimCheckout(order.id)
    await db.releaseCheckout(order.id)

    const result = await db.claimCheckout(order.id)
    expect(result).toEqual({ ok: true, order })
  })

  test('is a no-op for an order that was never locked', async () => {
    const order = await makeOrder()
    await expect(db.releaseCheckout(order.id)).resolves.not.toThrow()
  })
})

describe('clearAll()', () => {
  test('clears active locks so orders can be claimed again', async () => {
    const order = await makeOrder()
    await db.claimCheckout(order.id)

    await db.clearAll()
    await order.initialize()

    const result = await db.claimCheckout(order.id)
    expect(result.ok).toBe(true)
  })
})
