import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { orThrow } from '../lib/queryHelpers'
import { toAlert, toLaboratoryValidationRecord, toSensorReadings, toDeviceStatus } from '../lib/mappers'
import { hydrateTestRun } from '../lib/testRunHydrator'
import type { SensorReadingWithSensor } from '../types/db'

const router = express.Router()

// GET /dashboard/summary — bundles latest alerts (top 3), active test run,
// latest validation record, latest telemetry, and device status in one
// response, to cut round-trips for the Dashboard page.
router.get('/summary', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [alertsResult, activeRunResult, validationResult, readingsResult, deviceResult] = await Promise.all([
      supabaseAdmin.from('alerts').select('*').order('triggered_at', { ascending: false }).limit(3),
      supabaseAdmin
        .from('test_runs')
        .select('*')
        .eq('status', 'In Progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from('laboratory_validation_records').select('*').order('validated_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin
        .from('sensor_readings')
        .select('*, sensor:sensors!inner(category,position,unit)')
        .order('measured_at', { ascending: false })
        .limit(50),
      supabaseAdmin.from('devices').select('*').order('created_at').limit(1).maybeSingle(),
    ])

    const alerts = orThrow(alertsResult, 'Failed to load latest alerts.')
    const activeTestRun = orThrow(activeRunResult, 'Failed to load active test run.')
    const latestValidation = orThrow(validationResult, 'Failed to load latest validation record.')
    const readings = orThrow(readingsResult, 'Failed to load latest telemetry.') as unknown as SensorReadingWithSensor[]
    const device = orThrow(deviceResult, 'Failed to load device status.')

    const latestPerSensor = new Map<string, SensorReadingWithSensor>()
    for (const row of readings) {
      if (!latestPerSensor.has(row.sensor_id)) latestPerSensor.set(row.sensor_id, row)
    }

    res.json({
      alerts: alerts.map(toAlert),
      activeTestRun: activeTestRun ? await hydrateTestRun(activeTestRun) : null,
      latestValidation: latestValidation ? toLaboratoryValidationRecord(latestValidation) : null,
      telemetry: toSensorReadings([...latestPerSensor.values()]),
      deviceStatus: device ? toDeviceStatus(device) : null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
