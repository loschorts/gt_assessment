class PaymentMethod {
  clientId: string

  constructor(clientId: string) {
    this.clientId = clientId
  }

  async authorize(): Promise<void> {}

  async void(): Promise<void> {}
}

export default PaymentMethod
