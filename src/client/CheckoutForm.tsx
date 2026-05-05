import { useState, useEffect } from 'react'
import { cardStyles } from './styles'

interface Props {
  initialOrderId?: string
}

type CheckoutResult =
  | { ok: true; status: string }
  | { ok: false; error: string; status?: string }

export default function CheckoutForm({ initialOrderId }: Props) {
  const [orderId, setOrderId] = useState(initialOrderId ?? '')
  const [paymentId, setPaymentId] = useState('pay-001')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)

  useEffect(() => {
    if (initialOrderId) setOrderId(initialOrderId)
  }, [initialOrderId])

  const canSubmit = orderId.trim().length > 0 && paymentId.trim().length > 0 && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/orders/${orderId.trim()}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: paymentId.trim() }),
      })
      const body = await res.json()
      if (res.ok) {
        setResult({ ok: true, status: body.status })
      } else {
        setResult({ ok: false, error: body.error ?? 'Checkout failed', status: body.status })
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyles.card}>
      <div style={cardStyles.heading}>Checkout</div>
      <form onSubmit={handleSubmit}>
        <div style={cardStyles.field}>
          <label style={cardStyles.label}>Order ID</label>
          <input
            style={cardStyles.input}
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="Enter order ID"
          />
        </div>
        <div style={cardStyles.field}>
          <label style={cardStyles.label}>Payment ID</label>
          <input
            style={cardStyles.input}
            value={paymentId}
            onChange={e => setPaymentId(e.target.value)}
            placeholder="pay-001"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{ ...cardStyles.button, ...(!canSubmit ? cardStyles.buttonDisabled : {}) }}
        >
          {loading ? 'Processing…' : 'Submit Payment'}
        </button>
      </form>
      {result && (
        <div style={{ ...cardStyles.result, ...(result.ok ? cardStyles.resultSuccess : cardStyles.resultError) }}>
          {result.ok
            ? `Order ${result.status}`
            : `${result.error}${result.status ? ` (status: ${result.status})` : ''}`}
        </div>
      )}
    </div>
  )
}
