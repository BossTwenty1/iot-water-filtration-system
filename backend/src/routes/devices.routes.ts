import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { requireDeviceKey } from '../middleware/deviceAuth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow } from '../lib/queryHelpers'
import { toDeviceStatus, VALID_CATEGORIES, VALID_POSITIONS } from '../lib/mappers'
import type { DeviceRow, SensorReadingRow, SensorRow, TablesInsert, TablesUpdate } from '../types/db'

const router = express.Router()

// GET /devices — list known devices (needed to discover a deviceId before
// calling the :id-scoped routes below).
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = orThrow<DeviceRow[]>(await supabaseAdmin.from('devices').select('*').order('created_at'), 'Failed to load devices.')
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// GET /devices/:id — get one device.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<DeviceRow | null>(
      await supabaseAdmin.from('devices').select('*').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load device.'
    )
    if (!row) throw ApiError.notFound('Device was not found.')
    res.json(row)
  } catch (err) {
    next(err)
  }
})

// POST /devices — register a device. Device auth/provisioning is TBD
// (docs/PENDING_DECISIONS.md §8) — this route is a placeholder for manual
// registration until that's resolved.
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceIdentifier, name, isSimulated, controllerName } = req.body ?? {}
    if (!deviceIdentifier) throw ApiError.badRequest('deviceIdentifier is required.')

    const row = orThrow<DeviceRow | null>(
      await supabaseAdmin
        .from('devices')
        .insert({ device_identifier: deviceIdentifier, name, is_simulated: isSimulated ?? false, controller_name: controllerName })
        .select('*')
        .single(),
      'Failed to register device.'
    )
    if (!row) throw ApiError.badRequest('Failed to register device.')
    res.status(201).json(row)
  } catch (err) {
    next(err)
  }
})

// GET /devices/:id/status — device status (ESP32 connection, wifi, fail-safe).
router.get('/:id/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = orThrow<DeviceRow | null>(
      await supabaseAdmin.from('devices').select('*').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load device status.'
    )
    if (!device) throw ApiError.notFound('Device was not found.')

    let latestReadingAt: string | null = null
    if (!device.last_seen_at) {
      const latest = orThrow<{ received_at: string } | null>(
        await supabaseAdmin
          .from('sensor_readings')
          .select('received_at')
          .eq('device_id', device.id)
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        'Failed to load latest reading.'
      )
      latestReadingAt = latest?.received_at ?? null
    }

    res.json(toDeviceStatus({ ...device, latestReadingAt }))
  } catch (err) {
    next(err)
  }
})

// PUT /devices/:id/config — device control/connectivity config. Wired ahead
// of hardware integration per docs/plans/API ROUTES PLAN.md — the UI
// currently shows this as "Pending Hardware Integration."
router.put('/:id/config', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionState, wifiState, failSafeState, controllerName, config } = req.body ?? {}
    const patch: TablesUpdate<'devices'> = { last_seen_at: new Date().toISOString() }
    if (connectionState !== undefined) patch.connection_state = connectionState
    if (wifiState !== undefined) patch.wifi_state = wifiState
    if (failSafeState !== undefined) patch.fail_safe_state = failSafeState
    if (controllerName !== undefined) patch.controller_name = controllerName
    if (config !== undefined) patch.config = config

    const row = orThrow<DeviceRow | null>(
      await supabaseAdmin.from('devices').update(patch).eq('id', param(req, 'id')).select('*').maybeSingle(),
      'Failed to update device config.'
    )
    if (!row) throw ApiError.notFound('Device was not found.')
    res.json(toDeviceStatus(row))
  } catch (err) {
    next(err)
  }
})

interface IncomingReading {
  category?: unknown
  position?: unknown
  value?: unknown
  status?: unknown
}

interface SkippedReading {
  category: unknown
  position: unknown
  reason: string
}

// POST /devices/:id/readings — device/simulator telemetry ingestion.
// Authenticated with X-Device-Key (see requireDeviceKey), not a user Bearer
// token — a device has no Supabase session. Body:
// { measuredAt, testRunId?, readings: [{ category, position, value, status? }] }.
// Invalid/unregistered individual readings are skipped and reported back
// rather than failing the whole batch. On any successful insert, bumps
// devices.last_seen_at/connection_state — the heartbeat mechanism
// docs/API_REFERENCE.md's device-status section already anticipated.
router.post('/:id/readings', requireDeviceKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = param(req, 'id')
    const { measuredAt, testRunId, readings } = req.body ?? {}

    if (typeof measuredAt !== 'string' || Number.isNaN(new Date(measuredAt).getTime())) {
      throw ApiError.badRequest('measuredAt must be a valid ISO timestamp.')
    }
    if (!Array.isArray(readings) || readings.length === 0) {
      throw ApiError.badRequest('readings must be a non-empty array.')
    }

    const device = orThrow<Pick<DeviceRow, 'id'> | null>(
      await supabaseAdmin.from('devices').select('id').eq('id', deviceId).maybeSingle(),
      'Failed to load device.'
    )
    if (!device) throw ApiError.notFound('Device was not found.')

    if (testRunId !== undefined) {
      const run = orThrow<{ id: string } | null>(
        await supabaseAdmin.from('test_runs').select('id').eq('id', testRunId).maybeSingle(),
        'Failed to load test run.'
      )
      if (!run) throw ApiError.badRequest('testRunId does not reference an existing test run.')
    }

    const sensors = orThrow<SensorRow[]>(
      await supabaseAdmin.from('sensors').select('*').eq('device_id', deviceId),
      'Failed to load sensors.'
    )
    const sensorByKey = new Map(sensors.map((sensor) => [`${sensor.category}|${sensor.position}`, sensor]))

    const rows: TablesInsert<'sensor_readings'>[] = []
    const skipped: SkippedReading[] = []

    for (const reading of readings as IncomingReading[]) {
      const { category, position, value, status } = reading ?? {}
      if (typeof category !== 'string' || !VALID_CATEGORIES.includes(category)) {
        skipped.push({ category, position, reason: 'unknown category' })
        continue
      }
      if (typeof position !== 'string' || !VALID_POSITIONS.includes(position)) {
        skipped.push({ category, position, reason: 'unknown position' })
        continue
      }
      if (value !== null && value !== undefined && typeof value !== 'number') {
        skipped.push({ category, position, reason: 'value must be a number or null' })
        continue
      }

      const sensor = sensorByKey.get(`${category}|${position}`)
      if (!sensor) {
        skipped.push({ category, position, reason: 'sensor not registered for this device' })
        continue
      }

      rows.push({
        sensor_id: sensor.id,
        device_id: deviceId,
        value: value ?? null,
        reading_status: typeof status === 'string' ? status : null,
        measured_at: measuredAt,
        test_run_id: testRunId ?? null,
      })
    }

    if (rows.length > 0) {
      orThrow<SensorReadingRow[]>(
        await supabaseAdmin.from('sensor_readings').insert(rows).select('id'),
        'Failed to insert sensor readings.'
      )
      await supabaseAdmin
        .from('devices')
        .update({ last_seen_at: new Date().toISOString(), connection_state: 'Online' })
        .eq('id', deviceId)
    }

    res.status(rows.length > 0 ? 201 : 400).json({ deviceId, inserted: rows.length, skipped })
  } catch (err) {
    next(err)
  }
})

export default router
