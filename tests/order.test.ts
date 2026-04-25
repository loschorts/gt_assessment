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

  beforeEach(() => {
    order = new Order('client-1', ['ticket-1', 'ticket-2'])
    order.initialize()
    payment = new PaymentMethod('client-1')
    authorizeSpy = jest.spyOn(payment, 'authorize').mockResolvedValue()
    voidSpy = jest.spyOn(payment, 'void').mockResolvedValue()
    fulfillSpy = jest.spyOn(order, 'fulfill').mockResolvedValue()
  })

  afterEach(() => jest.restoreAllMocks())

  describe('getStatus()', () => {
    test('returns Pending before any checkout', () => {
      expect(order.getStatus()).toBe(OrderStatus.Pending)
    })
  })

  describe('checkout() — README validation test cases', () => {
    test('payment authorized and fulfillment succeeds → OrderComplete', async () => {
      const status = await order.checkout(payment)
      expect(status).toBe(OrderStatus.OrderComplete)
      expect(order.getStatus()).toBe(OrderStatus.OrderComplete)
    })

    test('payment authorization fails → PaymentDeclined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.PaymentDeclined)
      expect(order.getStatus()).toBe(OrderStatus.PaymentDeclined)
    })

    test('fulfillment fails, void succeeds → FulfillmentFailed', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.FulfillmentFailed)
      expect(order.getStatus()).toBe(OrderStatus.FulfillmentFailed)
    })

    test('fulfillment fails, void also fails → NeedsAttention', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())
      voidSpy.mockRejectedValue(new PaymentUnvoidableError())

      const status = await order.checkout(payment)

      expect(status).toBe(OrderStatus.NeedsAttention)
      expect(order.getStatus()).toBe(OrderStatus.NeedsAttention)
    })
  })

  describe('processing flag', () => {
    test('is set during checkout and cleared after', async () => {
      let flagDuringCheckout = false
      fulfillSpy.mockImplementation(async () => { flagDuringCheckout = order.processing })

      await order.checkout(payment)

      expect(flagDuringCheckout).toBe(true)
      expect(order.processing).toBe(false)
    })

    test('is cleared even when checkout throws unexpectedly', async () => {
      fulfillSpy.mockRejectedValue(new Error('Unexpected'))

      await expect(order.checkout(payment)).rejects.toThrow('Unexpected')
      expect(order.processing).toBe(false)
    })

    test('throws if order is already processing', async () => {
      order.processing = true
      await expect(order.checkout(payment)).rejects.toThrow('Order is already being processed')
    })
  })

  describe('statusHistory', () => {
    test('records PaymentAuthorized before OrderComplete on success', async () => {
      await order.checkout(payment)
      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.OrderComplete)
    })

    test('does not record PaymentAuthorized when payment is declined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      await order.checkout(payment)

      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).not.toContain(OrderStatus.PaymentAuthorized)
      expect(statuses).toContain(OrderStatus.PaymentDeclined)
    })

    test('records PaymentAuthorized then FulfillmentFailed when void succeeds', async () => {
      fulfillSpy.mockRejectedValue(new FulfillmentFailedError())

      await order.checkout(payment)

      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.FulfillmentFailed)
    })

    test('each history entry has a createdAt timestamp', async () => {
      await order.checkout(payment)
      order.statusHistory.forEach(entry => {
        expect(entry.createdAt).toBeInstanceOf(Date)
      })
    })
  })
})
