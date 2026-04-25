enum OrderStatus {
  Uninitialized = 'Uninitialized',
  Initialized = 'Initialized',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  Cancelled = 'Cancelled',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

export default OrderStatus
