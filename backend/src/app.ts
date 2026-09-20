import express from 'express'
import cors from 'cors'
import env from './config/env'
import routes from './routes'
import { supabaseAdmin } from './config/supabaseClient'
import { notFoundHandler, errorHandler } from './middleware/errorHandler'

const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

// No auth required — liveness check only, per docs/API_ROUTES_DRAFT.md §1.
// Never touches the network, so it stays "ok" even if Supabase is down.
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }))

// No auth required. R-07 ("Internet/cloud dependency during demo") — unlike
// the liveness check above, this actually reaches Supabase, so during a demo
// it can tell "this server is up but the cloud is unreachable" apart from
// "this server is up and everything is fine".
app.get('/api/v1/health/cloud', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('app_settings').select('id').limit(1)
    if (error) throw error
    res.json({ status: 'ok', cloud: 'reachable' })
  } catch {
    res.status(503).json({ status: 'degraded', cloud: 'unreachable' })
  }
})

app.use('/api/v1', routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
