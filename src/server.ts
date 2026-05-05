import app from './app'

const PORT = process.env.PORT ?? 3000

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start()
