import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, FulfillmentFailedError } from '../src/errors'

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
    authorizeSpy = jest.spyOn(payment, 'authorize').mockImplementation(() => {})
    voidSpy = jest.spyOn(payment, 'void').mockImplementation(() => {})
    fulfillSpy = jest.spyOn(order, 'fulfill').mockImplementation(() => {})
  })

  afterEach(() => jest.restoreAllMocks())

  describe('getStatus()', () => {
    test('returns Pending before any checkout', () => {
      expect(order.getStatus()).toBe(OrderStatus.Pending)
    })
  })

  describe('checkout() — README validation test cases', () => {
    test('payment authorized and fulfillment succeeds → OrderComplete', () => {
      const status = order.checkout(payment)
      expect(status).toBe(OrderStatus.OrderComplete)
      expect(order.getStatus()).toBe(OrderStatus.OrderComplete)
    })

    test('payment authorization fails → PaymentDeclined', () => {
      authorizeSpy.mockImplementation(() => { throw new PaymentDeclinedError() })

      const status = order.checkout(payment)

      expect(status).toBe(OrderStatus.PaymentDeclined)
      expect(order.getStatus()).toBe(OrderStatus.PaymentDeclined)
    })

    test('fulfillment fails, void succeeds → FulfillmentFailed', () => {
      fulfillSpy.mockImplementation(() => { throw new FulfillmentFailedError() })

      const status = order.checkout(payment)

      expect(status).toBe(OrderStatus.FulfillmentFailed)
      expect(order.getStatus()).toBe(OrderStatus.FulfillmentFailed)
    })

    test('fulfillment fails, void also fails → NeedsAttention', () => {
      fulfillSpy.mockImplementation(() => { throw new FulfillmentFailedError() })
      voidSpy.mockImplementation(() => { throw new Error('Void failed') })

      const status = order.checkout(payment)

      expect(status).toBe(OrderStatus.NeedsAttention)
      expect(order.getStatus()).toBe(OrderStatus.NeedsAttention)
    })
  })

  describe('processing flag', () => {
    test('is set during checkout and cleared after', () => {
      let flagDuringCheckout = false
      fulfillSpy.mockImplementation(() => { flagDuringCheckout = order.processing })

      order.checkout(payment)

      expect(flagDuringCheckout).toBe(true)
      expect(order.processing).toBe(false)
    })

    test('is cleared even when checkout throws unexpectedly', () => {
      fulfillSpy.mockImplementation(() => { throw new Error('Unexpected') })

      expect(() => order.checkout(payment)).toThrow('Unexpected')
      expect(order.processing).toBe(false)
    })

    test('throws if order is already processing', () => {
      order.processing = true
      expect(() => order.checkout(payment)).toThrow('Order is already being processed')
    })
  })

  describe('statusHistory', () => {
    test('records PaymentAuthorized before OrderComplete on success', () => {
      order.checkout(payment)
      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.OrderComplete)
    })

    test('does not record PaymentAuthorized when payment is declined', () => {
      authorizeSpy.mockImplementation(() => { throw new PaymentDeclinedError() })

      order.checkout(payment)

      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).not.toContain(OrderStatus.PaymentAuthorized)
      expect(statuses).toContain(OrderStatus.PaymentDeclined)
    })

    test('records PaymentAuthorized then FulfillmentFailed when void succeeds', () => {
      fulfillSpy.mockImplementation(() => { throw new FulfillmentFailedError() })

      order.checkout(payment)

      const statuses = order.statusHistory.map(e => e.status)
      expect(statuses).toContain(OrderStatus.PaymentAuthorized)
      expect(statuses.at(-1)).toBe(OrderStatus.FulfillmentFailed)
    })

    test('each history entry has a createdAt timestamp', () => {
      order.checkout(payment)
      order.statusHistory.forEach(entry => {
        expect(entry.createdAt).toBeInstanceOf(Date)
      })
    })
  })
})
