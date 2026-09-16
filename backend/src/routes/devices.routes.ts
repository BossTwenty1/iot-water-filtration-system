import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow } from '../lib/queryHelpers'
import { toDeviceStatus } from '../lib/mappers'
import type { DeviceRow, TablesUpdate } from '../types/db'

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

export default router
