import { useState, useEffect } from 'react'
import Badge from './Badge'
import { ResponseData } from '../types'

interface Props {
  selectedOrderId: string | null
  onSuccess: (response: ResponseData) => void
  onError: (msg: string) => void
}

export default function GetStatusForm({ selectedOrderId, onSuccess, onError }: Props) {
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState<{ status: string; timestamp: string | null } | null>(null)

  useEffect(() => {
    if (selectedOrderId) setOrderId(selectedOrderId)
  }, [selectedOrderId])

  async function fetchStatus(id: string) {
    try {
      const res = await fetch(`/orders/${id}/status`)
      const body = await res.json()
      onSuccess({ request: { method: 'GET', url: `/orders/${id}/status` }, status: res.status, body })
      if (res.ok) {
        const latest = body.history?.at(-1)
        setResult({ status: body.status, timestamp: latest?.createdAt ?? null })
      } else {
        setResult(null)
      }
    } catch (err) {
      onError(String(err))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    fetchStatus(orderId)
  }

  return (
    <div className="card">
      <h2>GET /orders/:id/status — Get Status</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>orderId</label>
          <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="paste or click a row ↓" />
        </div>
        <button type="submit" disabled={!orderId}>Get Status</button>
      </form>
      {result && (
        <div className="status-result">
          <Badge status={result.status} />
          {result.timestamp && <span className="status-ts">{new Date(result.timestamp).toLocaleTimeString()}</span>}
        </div>
      )}
    </div>
  )
}
