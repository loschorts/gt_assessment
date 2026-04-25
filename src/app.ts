import express from 'express'
import path from 'path'
import ordersRouter from './routes/orders'
import debugRouter from './routes/debug'

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use('/orders', ordersRouter)
app.use('/debug', debugRouter)

export default app
