import { ResponseData } from '../types'

interface Props {
  response: ResponseData | null
}

export default function ResponsePanel({ response }: Props) {
  if (!response) return null
  const { request: req, status, body } = response
  return (
    <div className="card response-card">
      <h2>Last Exchange</h2>
      {req && (
        <div className="exchange-section">
          <div className="exchange-label">Request — {req.method} {req.url}</div>
          <pre>{req.body ? JSON.stringify(req.body, null, 2) : '(no body)'}</pre>
        </div>
      )}
      <div className="exchange-section">
        <div className="exchange-label">Response — HTTP {status}</div>
        <pre className={status >= 400 ? 'error' : ''}>{JSON.stringify(body, null, 2)}</pre>
      </div>
    </div>
  )
}
