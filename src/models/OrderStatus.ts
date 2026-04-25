enum OrderStatus {
  Uninitialized = 'Uninitialized',
  Initialized = 'Initialized',
  PaymentDeclined = 'PaymentDeclined',
  Cancelled = 'Cancelled',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

export default OrderStatus
