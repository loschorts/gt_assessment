import { useState, useEffect } from 'react'
import { ResponseData } from './types'

interface Props {
  selectedOrderId: string | null
  onSuccess: (response: ResponseData) => void
  onError: (msg: string) => void
}

export default function CheckoutForm({ selectedOrderId, onSuccess, onError }: Props) {
  const [orderId, setOrderId] = useState('')
  const [paymentId, setPaymentId] = useState('pay-001')

  useEffect(() => {
    if (selectedOrderId) setOrderId(selectedOrderId)
  }, [selectedOrderId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const reqBody = { paymentId }
      const res = await fetch(`/orders/${orderId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      onSuccess({ request: { method: 'POST', url: `/orders/${orderId}/checkout`, body: reqBody }, status: res.status, body: await res.json() })
    } catch (err) {
      onError(String(err))
    }
  }

  return (
    <div className="card">
      <h2>POST /orders/:id/checkout — Checkout</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>orderId</label>
          <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="paste or click a row ↓" />
        </div>
        <div className="field">
          <label>paymentId</label>
          <input value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="pay-001" />
        </div>
        <button type="submit" disabled={!orderId}>Checkout</button>
      </form>
    </div>
  )
}
