import { useState } from 'react'
import { ResponseData } from './types'

interface Props {
  onSuccess: (response: ResponseData) => void
  onError: (msg: string) => void
}

export default function CreateOrderForm({ onSuccess, onError }: Props) {
  const [clientId, setClientId] = useState('client-1')
  const [ticketIds, setTicketIds] = useState('ticket-1,ticket-2')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const reqBody = {
        clientId,
        ticketIds: ticketIds.split(',').map(s => s.trim()).filter(Boolean),
      }
      const res = await fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      onSuccess({ request: { method: 'POST', url: '/orders', body: reqBody }, status: res.status, body: await res.json() })
    } catch (err) {
      onError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>POST /orders — Create Order</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>clientId</label>
          <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="client-1" />
        </div>
        <div className="field">
          <label>ticketIds (comma-separated)</label>
          <input value={ticketIds} onChange={e => setTicketIds(e.target.value)} placeholder="ticket-1,ticket-2" />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Create Order'}</button>
      </form>
    </div>
  )
}
