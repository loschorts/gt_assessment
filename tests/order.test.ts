import * as db from '../src/db'
import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, FulfillmentFailedError, PaymentUnvoidableError } from '../src/errors'

describe('Order', () => {
  let order: Order
  let payment: PaymentMethod
  let authorizeSpy: jest.SpyInstance
  let voidSpy: jest.SpyInstance
  let fulfillSpy: jest.SpyInstance

  beforeEach(async () => {
    await db.clearAll()
    order = new Order('client-1', ['ticket-1', 'ticket-2'])
    await db.createOrder(order)
    await order.initialize()
    payment = new PaymentMethod('client-1')
    authorizeSpy = jest.spyOn(payment, 'authorize').mockResolvedValue()
    voidSpy = jest.spyOn(payment, 'void').mockResolvedValue()
    fulfillSpy = jest.spyOn(order, 'fulfill').mockResolvedValue()
  })

  afterEach(() => jest.restoreAllMocks())

  describe('getStatus()', () => {
    test('returns Initialized before any checkout', async () => {
      expect(await order.getStatus()).toBe(OrderStatus.Initialized)
    })
  })

  describe('checkout() — README validation test cases', () => {
    test('payment authorized and fulfillment succeeds → Complete', async () => {
      const status = await order.checkout(payment)
      expect(status).toBe(OrderStatus.Complete)
      expect(await order.getStatus()).toBe(OrderStatus.Complete)
    })

    test('payment authorization fails → PaymentDeclined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.PaymentDeclined)
      expect(await order.getStatus()).toBe(OrderStatus.PaymentDeclined)
    })

    test('fulfillment fails, void succeeds → FulfillmentFailed', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.FulfillmentFailed)
      expect(await order.getStatus()).toBe(OrderStatus.FulfillmentFailed)
    })

    test('fulfillment fails, void also fails → NeedsAttention', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())
      voidSpy.mockRejectedValue(new PaymentUnvoidableError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.NeedsAttention)
      expect(await order.getStatus()).toBe(OrderStatus.NeedsAttention)
    })
  })

  describe('statusHistory', () => {
    test('records PaymentAuthorized before Complete on success', async () => {
      await order.checkout(payment)
      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.Complete)
    })

    test('does not record PaymentAuthorized when payment is declined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      await order.checkout(payment)

      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses).not.toContain(OrderStatus.PaymentAuthorized)
      expect(statuses).toContain(OrderStatus.PaymentDeclined)
    })

    test('records PaymentAuthorized then FulfillmentFailed when void succeeds', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())

      await order.checkout(payment)

      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.FulfillmentFailed)
    })

    test('each history entry has a createdAt timestamp', async () => {
      await order.checkout(payment)
      const history = await order.getStatusHistory()
      history.forEach(entry => {
        expect(entry.createdAt).toBeInstanceOf(Date)
      })
    })
  })
})
