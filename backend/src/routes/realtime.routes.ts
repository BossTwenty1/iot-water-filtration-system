import express, { type Request, type Response } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { orThrow } from '../lib/queryHelpers'
import { startSseStream } from '../lib/sse'
import env from '../config/env'
import { toAlert, groupReadingsIntoTelemetry } from '../lib/mappers'
import type { AlertRow, SensorReadingWithSensor } from '../types/db'

const router = express.Router()

// GET /realtime/stream — single SSE channel multiplexing telemetry + alert
// events, per the "Real-time strategy note" in
// docs/plans/API ROUTES PLAN.md (one channel instead of separate polling per
// page). Emits `event: telemetry` and `event: alert` frames; see
// docs/API_REFERENCE.md for the payload shapes.
router.get('/stream', requireAuth, (req: Request, res: Response) => {
  const { send } = startSseStream(req, res)
  let telemetryCursor = new Date().toISOString()
  let alertCursor = telemetryCursor

  const timer = setInterval(async () => {
    try {
      const readings = orThrow(
        await supabaseAdmin
          .from('sensor_readings')
          .select('*, sensor:sensors!inner(category,position,unit)')
          .gt('measured_at', telemetryCursor)
          .order('measured_at', { ascending: true }),
        'Failed to poll telemetry.'
      ) as unknown as SensorReadingWithSensor[]
      if (readings.length) {
        send('telemetry', groupReadingsIntoTelemetry(readings))
        telemetryCursor = readings.reduce((max, row) => (row.measured_at > max ? row.measured_at : max), telemetryCursor)
      }

      const alerts: AlertRow[] = orThrow(
        await supabaseAdmin.from('alerts').select('*').gt('triggered_at', alertCursor).order('triggered_at', { ascending: true }),
        'Failed to poll alerts.'
      )
      if (alerts.length) {
        send('alert', alerts.map(toAlert))
        alertCursor = alerts.reduce((max, row) => (row.triggered_at > max ? row.triggered_at : max), alertCursor)
      }
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, env.ssePollIntervalMs)

  req.on('close', () => clearInterval(timer))
})

export default router
