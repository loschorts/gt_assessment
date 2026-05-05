import express from 'express'
import path from 'path'
import ordersRouter from './routes/orders'
import debugRouter from './routes/debug'

const app = express()
app.use(express.json())

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist/client')))
}

app.use('/orders', ordersRouter)
app.use('/debug', debugRouter)

export default app
