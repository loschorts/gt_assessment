// Stub for a third-party payment provider (e.g. Stripe). In production,
// authorize() and void() would make authenticated API calls to that service.
class PaymentMethod {
  clientId: string

  constructor(clientId: string) {
    this.clientId = clientId
  }

  // Charges the payment method. Throws PaymentDeclinedError if the provider rejects it.
  async authorize(): Promise<void> {}

  // Reverses a previously authorized charge. Throws PaymentUnvoidableError if the provider cannot void it.
  async void(): Promise<void> {}
}

export default PaymentMethod
