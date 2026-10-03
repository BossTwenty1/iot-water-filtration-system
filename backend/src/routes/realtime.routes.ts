import express, { type Request, type Response } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { orThrow } from '../lib/queryHelpers'
import { startSseStream } from '../lib/sse'
import env from '../config/env'
import { toAlert, groupReadingsIntoTelemetry, toDeviceStatus } from '../lib/mappers'
import { realtimeBus } from '../lib/realtimeBus'
import { hydrateTestRun } from '../lib/testRunHydrator'
import type { AlertRow, SensorReadingWithSensor, DeviceRow, TestRunRow } from '../types/db'
import type { TelemetryRecord, SystemAlert, DeviceStatus, TestRun } from '../types/domain'

const router = express.Router()

// GET /realtime/stream — single SSE channel multiplexing telemetry, alert,
// device status, and test run events.
// Uses realtimeBus for instantaneous push notifications and keeps a database
// polling fallback to ensure multi-client synchronization.
router.get('/stream', requireAuth, async (req: Request, res: Response) => {
  const { send } = startSseStream(req, res)
  let telemetryCursor = new Date().toISOString()
  let alertCursor = telemetryCursor
  let deviceCursor = telemetryCursor

  // 1. Send immediate initial state snapshot on connection
  try {
    const [deviceRes, activeRunRes, alertsRes, readingsRes] = await Promise.allSettled([
      supabaseAdmin.from('devices').select('*').limit(1).maybeSingle(),
      supabaseAdmin.from('test_runs').select('*').eq('status', 'In Progress').maybeSingle(),
      supabaseAdmin.from('alerts').select('*').order('triggered_at', { ascending: false }).limit(20),
      supabaseAdmin
        .from('sensor_readings')
        .select('*, sensor:sensors!inner(category,position,unit)')
        .order('measured_at', { ascending: false })
        .limit(20),
    ])

    if (deviceRes.status === 'fulfilled' && deviceRes.value.data) {
      send('device', toDeviceStatus(deviceRes.value.data as DeviceRow))
    }

    if (activeRunRes.status === 'fulfilled' && activeRunRes.value.data) {
      const hydrated = await hydrateTestRun(activeRunRes.value.data as TestRunRow)
      send('test_run', hydrated)
    }

    if (alertsRes.status === 'fulfilled' && alertsRes.value.data?.length) {
      send('alert', (alertsRes.value.data as AlertRow[]).map(toAlert))
    }

    if (readingsRes.status === 'fulfilled' && readingsRes.value.data?.length) {
      send('telemetry', groupReadingsIntoTelemetry(readingsRes.value.data as unknown as SensorReadingWithSensor[]))
    }
  } catch (err) {
    console.error('Failed to send initial SSE snapshot:', err instanceof Error ? err.message : err)
  }

  // 2. Wire up realtimeBus listeners for zero-latency instant push
  const handleTelemetry = (records: TelemetryRecord[]) => {
    if (records.length) {
      send('telemetry', records)
      telemetryCursor = records.reduce((max, row) => (row.timestamp > max ? row.timestamp : max), telemetryCursor)
    }
  }

  const handleAlert = (alerts: SystemAlert[]) => {
    if (alerts.length) {
      send('alert', alerts)
      alertCursor = alerts.reduce((max, row) => (row.timestamp > max ? row.timestamp : max), alertCursor)
    }
  }

  const handleDevice = (status: DeviceStatus) => {
    send('device', status)
    deviceCursor = new Date().toISOString()
  }

  const handleTestRun = (run: TestRun) => {
    send('test_run', run)
  }

  realtimeBus.on('telemetry', handleTelemetry)
  realtimeBus.on('alert', handleAlert)
  realtimeBus.on('device', handleDevice)
  realtimeBus.on('test_run', handleTestRun)

  // 3. Fallback database polling interval for background updates or external mutations
  const timer = setInterval(async () => {
    try {
      // Poll new telemetry
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

      // Poll alerts using updated_at or triggered_at to catch transitions (Acknowledged, Resolved)
      const alerts: AlertRow[] = orThrow(
        await supabaseAdmin
          .from('alerts')
          .select('*')
          .or(`updated_at.gt.${alertCursor},triggered_at.gt.${alertCursor}`)
          .order('triggered_at', { ascending: true }),
        'Failed to poll alerts.'
      )
      if (alerts.length) {
        send('alert', alerts.map(toAlert))
        alertCursor = alerts.reduce((max, row) => {
          const t = (row as any).updated_at || row.triggered_at
          return t > max ? t : max
        }, alertCursor)
      }

      // Check device heartbeat / status update
      const { data: updatedDevices } = await supabaseAdmin
        .from('devices')
        .select('*')
        .or(`updated_at.gt.${deviceCursor},last_seen_at.gt.${deviceCursor}`)
        .order('last_seen_at', { ascending: false })
        .limit(1)

      if (updatedDevices && updatedDevices.length > 0) {
        const latestDev = updatedDevices[0]!
        send('device', toDeviceStatus(latestDev as DeviceRow))
        deviceCursor = new Date().toISOString()
      }
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, env.ssePollIntervalMs)

  req.on('close', () => {
    clearInterval(timer)
    realtimeBus.off('telemetry', handleTelemetry)
    realtimeBus.off('alert', handleAlert)
    realtimeBus.off('device', handleDevice)
    realtimeBus.off('test_run', handleTestRun)
  })
})

export default router
