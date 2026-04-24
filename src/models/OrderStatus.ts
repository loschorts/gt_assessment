enum OrderStatus {
  Pending = 'Pending',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentDeclined = 'PaymentDeclined',
  FulfillmentFailed = 'FulfillmentFailed',
  NeedsAttention = 'NeedsAttention',
  OrderComplete = 'OrderComplete',
}

export default OrderStatus
