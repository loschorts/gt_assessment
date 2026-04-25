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

export class PaymentUnvoidableError extends Error {
  constructor(message = 'Payment could not be voided') {
    super(message)
    this.name = 'PaymentUnvoidableError'
  }
}

export class CheckoutConflictError extends Error {
  constructor(message = 'Order has already been processed or is currently being processed') {
    super(message)
    this.name = 'CheckoutConflictError'
  }
}
