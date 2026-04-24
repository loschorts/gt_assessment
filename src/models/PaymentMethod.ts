class PaymentMethod {
  clientId: string

  constructor(clientId: string) {
    this.clientId = clientId
  }

  authorize(): void {}

  void(): void {}
}

export default PaymentMethod
