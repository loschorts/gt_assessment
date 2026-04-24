export class PaymentDeclinedError extends Error {
  constructor(message = 'Payment declined') {
    super(message)
    this.name = 'PaymentDeclinedError'
  }
}

export class FulfillmentFailedError extends Error {
  constructor(message = 'Fulfillment failed') {
    super(message)
    this.name = 'FulfillmentFailedError'
  }
}
