import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import CreateOrderForm from './CreateOrderForm'
import CheckoutForm from './CheckoutForm'

function App() {
  const [orderId, setOrderId] = useState<string | undefined>(undefined)

  return (
    <div style={{
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 13,
      background: '#0f1117',
      color: '#cdd6f4',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 40,
      flexWrap: 'wrap',
    }}>
      <CreateOrderForm onOrderCreated={setOrderId} />
      <CheckoutForm initialOrderId={orderId} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
