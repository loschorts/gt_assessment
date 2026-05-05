import { useState, useEffect, useCallback } from 'react'
import CreateOrderForm from './CreateOrderForm'
import CheckoutForm from './CheckoutForm'
import GetStatusForm from './GetStatusForm'
import ResponsePanel from './ResponsePanel'
import OrdersTable from './OrdersTable'
import StatusHistoryTable from './StatusHistoryTable'
import SimulationPanel from './SimulationPanel'
import { DbState, ResponseData } from './types'

const EMPTY_DB: DbState = { orders: [], statusHistory: [] }

export default function App() {
  const [dbState, setDbState] = useState<DbState>(EMPTY_DB)
  const [lastResponse, setLastResponse] = useState<ResponseData | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/debug/state')
      setDbState(await res.json())
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchState()
    const timer = setInterval(fetchState, 2000)
    return () => clearInterval(timer)
  }, [fetchState])

  function handleSuccess(response: ResponseData) {
    setLastResponse(response)
    const orderId = response.body?.orderId
    if (typeof orderId === 'string') setSelectedOrderId(orderId)
    fetchState()
  }

  function handleError(msg: string) {
    setLastResponse({ request: { method: '', url: '' }, status: 0, body: { error: msg } })
  }

  return (
    <>
      <header>
        Order State Machine
        <span>dev console</span>
        <div className="live-indicator">
          <div className="refresh-dot" />
          <span>live</span>
        </div>
      </header>

      <div className="main">
        <div className="forms">
          <CreateOrderForm onSuccess={handleSuccess} onError={handleError} />
          <CheckoutForm selectedOrderId={selectedOrderId} onSuccess={handleSuccess} onError={handleError} />
          <GetStatusForm selectedOrderId={selectedOrderId} onSuccess={handleSuccess} onError={handleError} />
        </div>

        <SimulationPanel />

        <ResponsePanel response={lastResponse} />

        <div className="card table-section">
          <h2>Orders ({dbState.orders.length})</h2>
          <OrdersTable orders={dbState.orders} selectedId={selectedOrderId} onSelect={setSelectedOrderId} />
        </div>

        <div className="card table-section">
          <h2>Status History ({dbState.statusHistory.length})</h2>
          <StatusHistoryTable rows={dbState.statusHistory} />
        </div>
      </div>
    </>
  )
}
