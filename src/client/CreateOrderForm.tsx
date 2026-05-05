import { useState } from 'react'
import { cardStyles } from './styles'

interface Props {
  onOrderCreated: (orderId: string) => void
}

export default function CreateOrderForm({ onOrderCreated }: Props) {
  const [clientId, setClientId] = useState('client-1')
  const [ticketIds, setTicketIds] = useState('ticket-1,ticket-2')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body = {
        clientId: clientId.trim(),
        ticketIds: ticketIds.split(',').map(s => s.trim()).filter(Boolean),
      }
      const res = await fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        onOrderCreated(data.orderId)
      } else {
        setError(data.error ? JSON.stringify(data.error) : 'Failed to create order')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyles.card}>
      <div style={cardStyles.heading}>Create Order</div>
      <form onSubmit={handleSubmit}>
        <div style={cardStyles.field}>
          <label style={cardStyles.label}>Client ID</label>
          <input
            style={cardStyles.input}
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="client-1"
          />
        </div>
        <div style={cardStyles.field}>
          <label style={cardStyles.label}>Ticket IDs (comma-separated)</label>
          <input
            style={cardStyles.input}
            value={ticketIds}
            onChange={e => setTicketIds(e.target.value)}
            placeholder="ticket-1,ticket-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ ...cardStyles.button, ...(loading ? cardStyles.buttonDisabled : {}) }}
        >
          {loading ? 'Creating…' : 'Create Order'}
        </button>
      </form>
      {error && (
        <div style={{ ...cardStyles.result, ...cardStyles.resultError }}>{error}</div>
      )}
    </div>
  )
}
