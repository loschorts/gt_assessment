import { Router, Request, Response } from 'express'
import { getDb } from '../database'
import { getLockEvents } from '../debugLog'
import { getSimulatedErrors, setSimulatedErrors } from '../simulation'

const router = Router()

router.get('/state', async (_req: Request, res: Response) => {
  const db = await getDb()

  const [orders, statusHistory, locks] = await Promise.all([
    db.all(`
      SELECT o.id, o.client_id, o.ticket_ids, o.payment_id,
             (SELECT osh.status FROM order_status_history osh
              WHERE osh.order_id = o.id ORDER BY osh.id DESC LIMIT 1) AS current_status
      FROM orders o ORDER BY rowid ASC
    `),
    db.all('SELECT * FROM order_status_history ORDER BY id ASC'),
    db.all('SELECT * FROM checkout_locks'),
  ])

  return res.json({ orders, statusHistory, locks, lockEvents: getLockEvents() })
})

router.get('/simulate', (_req: Request, res: Response) => {
  res.json({ simulating: getSimulatedErrors() })
})

router.post('/simulate', (req: Request, res: Response) => {
  const { errors } = req.body as { errors?: string[] }
  setSimulatedErrors(Array.isArray(errors) ? errors : [])
  res.json({ simulating: getSimulatedErrors() })
})

export default router
