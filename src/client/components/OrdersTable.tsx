import Badge from './Badge'
import { Order } from '../types'

function shortId(id: string) {
  return id ? id.slice(0, 8) + '…' : '—'
}

interface Props {
  orders: Order[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function OrdersTable({ orders, selectedId, onSelect }: Props) {
  if (!orders.length) return <div className="empty">No orders yet.</div>
  return (
    <table>
      <thead>
        <tr><th>id</th><th>clientId</th><th>ticketIds</th><th>paymentId</th><th>status</th></tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr
            key={o.id}
            className={o.id === selectedId ? 'selected' : ''}
            onClick={() => onSelect(o.id)}
            title={o.id}
          >
            <td title={o.id}>{shortId(o.id)}</td>
            <td>{o.client_id}</td>
            <td>{o.ticket_ids}</td>
            <td title={o.payment_id ?? ''}>{o.payment_id ? shortId(o.payment_id) : '—'}</td>
            <td><Badge status={o.current_status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
