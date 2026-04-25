import { clearAll } from '../src/db'
import Order from '../src/models/Order'
import PaymentMethod from '../src/models/PaymentMethod'
import OrderStatus from '../src/models/OrderStatus'
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError } from '../src/errors'

describe('Order', () => {
  let order: Order
  let payment: PaymentMethod
  let authorizeSpy: jest.SpyInstance
  let voidSpy: jest.SpyInstance
  let completeSpy: jest.SpyInstance

  beforeEach(async () => {
    await clearAll()
    order = new Order('client-1', ['ticket-1', 'ticket-2'])
    await order.initialize()
    payment = new PaymentMethod('client-1')
    authorizeSpy = jest.spyOn(payment, 'authorize').mockResolvedValue()
    voidSpy = jest.spyOn(payment, 'void').mockResolvedValue()
    completeSpy = jest.spyOn(order, 'tryComplete').mockResolvedValue()
  })

  afterEach(() => jest.restoreAllMocks())

  describe('getStatus()', () => {
    test('returns Initialized before any checkout', async () => {
      expect(await order.getStatus()).toBe(OrderStatus.Initialized)
    })
  })

  describe('tryCheckout() — README validation test cases', () => {
    test('payment authorized and completion succeeds → Complete', async () => {
      const status = await order.tryCheckout(payment, 'pay-test')
      expect(status).toBe(OrderStatus.Complete)
      expect(await order.getStatus()).toBe(OrderStatus.Complete)
    })

    test('payment authorization fails → PaymentDeclined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      const status = await order.tryCheckout(payment, 'pay-test')

      expect(status).toBe(OrderStatus.PaymentDeclined)
      expect(await order.getStatus()).toBe(OrderStatus.PaymentDeclined)
    })

    test('completion fails, void succeeds → Cancelled', async () => {
      completeSpy.mockRejectedValue(new CompletionFailedError())

      const status = await order.tryCheckout(payment, 'pay-test')

      expect(status).toBe(OrderStatus.Cancelled)
      expect(await order.getStatus()).toBe(OrderStatus.Cancelled)
    })

    test('completion fails, void also fails → NeedsAttention', async () => {
      completeSpy.mockRejectedValue(new CompletionFailedError())
      voidSpy.mockRejectedValue(new PaymentUnvoidableError())

      const status = await order.tryCheckout(payment, 'pay-test')

      expect(status).toBe(OrderStatus.NeedsAttention)
      expect(await order.getStatus()).toBe(OrderStatus.NeedsAttention)
    })
  })

  describe('statusHistory', () => {
    test('final status is Complete on success', async () => {
      await order.tryCheckout(payment, 'pay-test')
      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses.at(-1)).toBe(OrderStatus.Complete)
    })

    test('final status is PaymentDeclined when payment is declined', async () => {
      authorizeSpy.mockRejectedValue(new PaymentDeclinedError())

      await order.tryCheckout(payment, 'pay-test')

      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses.at(-1)).toBe(OrderStatus.PaymentDeclined)
    })

    test('final status is Cancelled when completion fails but void succeeds', async () => {
      completeSpy.mockRejectedValue(new CompletionFailedError())

      await order.tryCheckout(payment, 'pay-test')

      const statuses = (await order.getStatusHistory()).map(e => e.status)
      expect(statuses.at(-1)).toBe(OrderStatus.Cancelled)
    })

    test('each history entry has a createdAt timestamp', async () => {
      await order.tryCheckout(payment, 'pay-test')
      const history = await order.getStatusHistory()
      history.forEach(entry => {
        expect(entry.createdAt).toBeInstanceOf(Date)
      })
    })
  })
})
