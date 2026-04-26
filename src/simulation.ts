// Error injection for the browser demo UI only. Not used by tests — tests use Jest spies.
import { PaymentDeclinedError, CompletionFailedError, PaymentUnvoidableError } from './errors'

export type SimulatableError = typeof PaymentDeclinedError | typeof CompletionFailedError | typeof PaymentUnvoidableError

const active = new Set<string>()

export function setSimulatedErrors(errors: string[]): void {
  active.clear()
  errors.forEach(e => active.add(e))
}

export function getSimulatedErrors(): string[] {
  return [...active]
}

export function throwIfSimulated(ErrorClass: SimulatableError): void {
  if (!active.has(ErrorClass.name)) return
  throw new ErrorClass('Simulated')
}
