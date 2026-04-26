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

export class InvalidTransitionError extends Error {
  constructor(public readonly currentStatus: string) {
    super(`Invalid transition from status: ${currentStatus}`)
    this.name = 'InvalidTransitionError'
  }
}

export class OrderNotInitializedError extends Error {
  constructor() {
    super('Order has no status history — initialize() was never called')
    this.name = 'OrderNotInitializedError'
  }
}
