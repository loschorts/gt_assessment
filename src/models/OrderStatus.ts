enum OrderStatus {
  Uninitialized = 'Uninitialized',
  Initialized = 'Initialized',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  FulfillmentFailed = 'FulfillmentFailed',
  NeedsAttention = 'NeedsAttention',
  Complete = 'Complete',
}

export default OrderStatus
