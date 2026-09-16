import express from 'express'
import cors from 'cors'
import env from './config/env'
import routes from './routes'
import { notFoundHandler, errorHandler } from './middleware/errorHandler'

const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

// No auth required — liveness check only, per docs/API_ROUTES_DRAFT.md §1.
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/v1', routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
