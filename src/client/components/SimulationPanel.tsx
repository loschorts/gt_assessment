import { useState, useEffect } from 'react'

const SIMULATABLE_ERRORS = [
  { name: 'PaymentDeclinedError',      desc: 'authorize() throws → PaymentDeclined' },
  { name: 'InventoryNotAvailableError', desc: 'checkInventory() throws → InventoryNotAvailable → Cancelled (or NeedsAttention if combined below)' },
  { name: 'CompletionFailedError',     desc: 'tryComplete() throws → Cancelled (or NeedsAttention if combined below)' },
  { name: 'PaymentUnvoidableError',    desc: 'void() throws → NeedsAttention (combine with InventoryNotAvailableError or CompletionFailedError)' },
]

export default function SimulationPanel() {
  const [active, setActive] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/debug/simulate')
      .then(r => r.json())
      .then(d => setActive(new Set(d.simulating)))
  }, [])

  async function toggle(name: string) {
    const next = new Set(active)
    if (next.has(name)) next.delete(name); else next.add(name)
    setActive(next)
    await fetch('/debug/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: [...next] }),
    })
  }

  return (
    <div className="card">
      <h2>Error Simulation</h2>
      {SIMULATABLE_ERRORS.map(({ name, desc }) => (
        <div key={name} className="sim-row">
          <input type="checkbox" id={name} checked={active.has(name)} onChange={() => toggle(name)} />
          <label htmlFor={name}>{name} <span className="sim-desc">{desc}</span></label>
        </div>
      ))}
    </div>
  )
}
