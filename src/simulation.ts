import { PaymentDeclinedError, FulfillmentFailedError, PaymentUnvoidableError, CheckoutConflictError } from './errors'

const active = new Set<string>()

export function setSimulatedErrors(errors: string[]): void {
  active.clear()
  errors.forEach(e => active.add(e))
}

export function getSimulatedErrors(): string[] {
  return [...active]
}

export function throwIfSimulated(errorName: string): void {
  if (!active.has(errorName)) return
  switch (errorName) {
    case 'PaymentDeclinedError':   throw new PaymentDeclinedError('Simulated')
    case 'FulfillmentFailedError': throw new FulfillmentFailedError('Simulated')
    case 'PaymentUnvoidableError': throw new PaymentUnvoidableError('Simulated')
    case 'CheckoutConflictError':  throw new CheckoutConflictError('Simulated')
  }
}
