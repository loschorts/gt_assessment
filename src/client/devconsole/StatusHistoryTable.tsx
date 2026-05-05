import Badge from './Badge'
import { StatusRow } from './types'

function shortId(id: string) {
  return id ? id.slice(0, 8) + '…' : '—'
}

interface Props {
  rows: StatusRow[]
}

export default function StatusHistoryTable({ rows }: Props) {
  if (!rows.length) return <div className="empty">No status history yet.</div>
  return (
    <table>
      <thead>
        <tr><th>#</th><th>orderId</th><th>status</th><th>createdAt</th></tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{r.id}</td>
            <td title={r.order_id}>{shortId(r.order_id)}</td>
            <td><Badge status={r.status} /></td>
            <td>{r.created_at}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
