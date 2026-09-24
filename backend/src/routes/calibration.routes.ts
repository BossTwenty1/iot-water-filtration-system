import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, type PaginationQuery } from '../lib/queryHelpers'
import { toCalibrationRecord, parameterToCategory, stageToPosition } from '../lib/mappers'
import { SENSOR_MODELS } from '../lib/sensorModels'
import type { CalibrationRecordWithSensor } from '../types/db'
import type { CalibrationRecord } from '../types/domain'

const router = express.Router()
const CALIBRATION_SELECT = '*, sensor:sensors!inner(category,position,unit)'

interface CalibrationListQuery extends PaginationQuery {
  parameter?: string
  stage?: string
  status?: string
}

async function resolveSensorId({
  parameter,
  stage,
  deviceId,
}: {
  parameter: string
  stage: string
  deviceId?: string
}): Promise<string> {
  const deviceQuery = deviceId
    ? supabaseAdmin.from('devices').select('id').eq('id', deviceId)
    : supabaseAdmin.from('devices').select('id').limit(1)
  const device = orThrow<{ id: string } | null>(await deviceQuery.maybeSingle(), 'Failed to resolve device.')
  if (!device) throw ApiError.badRequest('No device available to attach this calibration record to.')

  const sensor = orThrow<{ id: string } | null>(
    await supabaseAdmin
      .from('sensors')
      .select('id')
      .eq('device_id', device.id)
      .eq('category', parameterToCategory(parameter))
      .eq('position', stageToPosition(stage))
      .maybeSingle(),
    'Failed to resolve sensor.'
  )
  if (!sensor) throw ApiError.notFound(`No ${parameter}/${stage} sensor is registered for this device.`)
  return sensor.id
}

// GET /calibration — list; query params parameter, stage, status.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as CalibrationListQuery
    const { limit, offset } = parsePagination(query)
    let builder = supabaseAdmin.from('calibration_records').select(CALIBRATION_SELECT)
    if (query.parameter) builder = builder.eq('sensor.category', parameterToCategory(query.parameter))
    if (query.stage) builder = builder.eq('sensor.position', stageToPosition(query.stage))
    if (query.status) builder = builder.eq('parameters->>status', query.status)
    builder = builder.order('performed_at', { ascending: false }).range(offset, offset + limit - 1)

    const rows = orThrow(await builder, 'Failed to load calibration records.') as unknown as CalibrationRecordWithSensor[]
    res.json(rows.map(toCalibrationRecord))
  } catch (err) {
    next(err)
  }
})

// GET /calibration/:id — detail.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow(
      await supabaseAdmin.from('calibration_records').select(CALIBRATION_SELECT).eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load calibration record.'
    ) as unknown as CalibrationRecordWithSensor | null
    if (!row) throw ApiError.notFound('Calibration record was not found.')
    res.json(toCalibrationRecord(row))
  } catch (err) {
    next(err)
  }
})

// GET /calibration/:id/history — error-history series for the same sensor.
router.get('/:id/history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = orThrow<{ sensor_id: string } | null>(
      await supabaseAdmin.from('calibration_records').select('sensor_id').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load calibration record.'
    )
    if (!current) throw ApiError.notFound('Calibration record was not found.')

    const rows = orThrow(
      await supabaseAdmin
        .from('calibration_records')
        .select(CALIBRATION_SELECT)
        .eq('sensor_id', current.sensor_id)
        .order('performed_at', { ascending: true }),
      'Failed to load calibration history.'
    ) as unknown as CalibrationRecordWithSensor[]
    res.json(rows.map(toCalibrationRecord))
  } catch (err) {
    next(err)
  }
})

// POST /calibration — create.
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { parameter, stage, referenceValue, sensorReading, deviceId } = req.body ?? {}
    if (!parameter || !stage || referenceValue === undefined || sensorReading === undefined) {
      throw ApiError.badRequest('parameter, stage, referenceValue and sensorReading are required.')
    }

    const sensorId = await resolveSensorId({ parameter, stage, deviceId })
    const meta = SENSOR_MODELS[parameter as CalibrationRecord['parameter']] ?? { model: 'Pending Confirmation', unit: '' }

    const row = orThrow(
      await supabaseAdmin
        .from('calibration_records')
        .insert({
          sensor_id: sensorId,
          performed_by: (req.profile as { id: string }).id,
          parameters: { referenceValue, sensorReading, model: meta.model, status: 'Record Available' },
          notes: 'Calibration record created. Method details require research-team approval.',
        })
        .select(CALIBRATION_SELECT)
        .single(),
      'Failed to create calibration record.'
    ) as unknown as CalibrationRecordWithSensor
    res.status(201).json(toCalibrationRecord(row))
  } catch (err) {
    next(err)
  }
})

export default router
