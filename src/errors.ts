export class PaymentDeclinedError extends Error {
  constructor(message = 'Payment declined') {
    super(message)
    this.name = 'PaymentDeclinedError'
  }
}

export class CompletionFailedError extends Error {
  constructor(message = 'Completion failed') {
    super(message)
    this.name = 'CompletionFailedError'
  }
}

export class PaymentUnvoidableError extends Error {
  constructor(message = 'Payment could not be voided') {
    super(message)
    this.name = 'PaymentUnvoidableError'
  }
}

export class CheckoutNotAllowedError extends Error {
  constructor(public readonly currentStatus: string) {
    super(`Checkout not allowed from status: ${currentStatus}`)
    this.name = 'CheckoutNotAllowedError'
  }
}

export class InvalidTransitionError extends Error {
  constructor(public readonly currentStatus: string, public readonly attemptedStatus: string) {
    super(`Invalid transition from ${currentStatus} to ${attemptedStatus}`)
    this.name = 'InvalidTransitionError'
  }
}

export class OrderNotInitializedError extends Error {
  constructor() {
    super('Order has no status history — initialize() was never called')
    this.name = 'OrderNotInitializedError'
  }
}
