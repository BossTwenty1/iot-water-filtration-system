import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, applyDateRange, type DateRangeQuery, type PaginationQuery } from '../lib/queryHelpers'
import { pollAndStream } from '../lib/sse'
import env from '../config/env'
import { groupReadingsIntoTelemetry, toSensorReadings, parameterToCategory, stageToPosition } from '../lib/mappers'
import type { SensorReadingWithSensor } from '../types/db'
import type { TelemetryRecord } from '../types/domain'

const router = express.Router()

// `!inner` so `.eq('sensor.category', ...)` filters actually restrict the
// parent rows (PostgREST only applies embedded-resource filters as a real
// join condition when the embed is an inner join).
const READING_SELECT = '*, sensor:sensors!inner(category,position,unit)'

interface TelemetryListQuery extends PaginationQuery, DateRangeQuery {
  testRunId?: string
  deviceId?: string
  parameter?: string
  stage?: string
}

function applyReadingFilters(builder: any, query: TelemetryListQuery) {
  let result = applyDateRange(builder, 'measured_at', query)
  if (query.testRunId) result = result.eq('test_run_id', query.testRunId)
  if (query.deviceId) result = result.eq('device_id', query.deviceId)
  return result
}

// GET /telemetry — list telemetry records (pivoted before/after per reading cycle).
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as TelemetryListQuery
    const { limit, offset } = parsePagination(query, { defaultLimit: 200, maxLimit: 1000 })
    let builder = supabaseAdmin.from('sensor_readings').select(READING_SELECT)
    builder = applyReadingFilters(builder, query)

    if (query.parameter) builder = builder.eq('sensor.category', parameterToCategory(query.parameter))
    if (query.stage) builder = builder.eq('sensor.position', stageToPosition(query.stage))

    builder = builder.order('measured_at', { ascending: false }).range(offset, offset + limit - 1)
    const rows = orThrow(await builder, 'Failed to load telemetry.')
    res.json(groupReadingsIntoTelemetry(rows as unknown as SensorReadingWithSensor[]))
  } catch (err) {
    next(err)
  }
})

// GET /telemetry/current — latest before/after snapshot for the live SensorGrid.
router.get('/current', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let builder = supabaseAdmin.from('sensor_readings').select(READING_SELECT)
    if (req.query.deviceId) builder = builder.eq('device_id', req.query.deviceId as string)
    builder = builder.order('measured_at', { ascending: false }).limit(50)

    const rows = orThrow(await builder, 'Failed to load current telemetry.') as unknown as SensorReadingWithSensor[]
    const latestPerSensor = new Map<string, SensorReadingWithSensor>()
    for (const row of rows) {
      if (!latestPerSensor.has(row.sensor_id)) latestPerSensor.set(row.sensor_id, row)
    }
    res.json(toSensorReadings([...latestPerSensor.values()]))
  } catch (err) {
    next(err)
  }
})

// GET /telemetry/chart — pre-aggregated series for a single parameter.
router.get('/chart', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parameter = (req.query.parameter as string) ?? 'turbidity'
    const category = parameterToCategory(parameter)

    let builder = supabaseAdmin.from('sensor_readings').select(READING_SELECT).eq('sensor.category', category)
    builder = applyDateRange(builder, 'measured_at', req.query as DateRangeQuery)
    builder = builder.order('measured_at', { ascending: true }).limit(500)

    const rows = orThrow(await builder, 'Failed to load chart data.') as unknown as SensorReadingWithSensor[]
    const byTime = new Map<string, { time: string; before?: number; after?: number }>()
    for (const row of rows) {
      if (!byTime.has(row.measured_at)) byTime.set(row.measured_at, { time: row.measured_at })
      const point = byTime.get(row.measured_at) as { time: string; before?: number; after?: number }
      const stage = row.sensor?.position === 'pre_filtration' ? 'before' : 'after'
      if (row.value !== null) point[stage] = row.value
    }
    res.json([...byTime.values()])
  } catch (err) {
    next(err)
  }
})

// GET /telemetry/stream — SSE push of new sensor readings as they arrive.
router.get('/stream', requireAuth, (req: Request, res: Response) => {
  pollAndStream<SensorReadingWithSensor, TelemetryRecord[]>({
    req,
    res,
    event: 'telemetry',
    cursorField: 'measured_at',
    intervalMs: env.ssePollIntervalMs,
    fetchLatest: async (since) => {
      let builder = supabaseAdmin.from('sensor_readings').select(READING_SELECT).gt('measured_at', since)
      if (req.query.deviceId) builder = builder.eq('device_id', req.query.deviceId as string)
      return orThrow(await builder.order('measured_at', { ascending: true }), 'Failed to poll telemetry.') as unknown as SensorReadingWithSensor[]
    },
    transform: groupReadingsIntoTelemetry,
  })
})

// GET /telemetry/:id — single grouped record detail (id is the opaque key
// returned by GET /telemetry: `deviceId|testRunId|measuredAt`).
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [deviceId, testRunId, measuredAt] = decodeURIComponent(param(req, 'id')).split('|')
    if (!deviceId || !measuredAt) throw ApiError.badRequest('Malformed telemetry id.')

    let builder = supabaseAdmin.from('sensor_readings').select(READING_SELECT).eq('device_id', deviceId).eq('measured_at', measuredAt)
    builder = testRunId ? builder.eq('test_run_id', testRunId) : builder.is('test_run_id', null)

    const rows = orThrow(await builder, 'Failed to load telemetry record.') as unknown as SensorReadingWithSensor[]
    const [record] = groupReadingsIntoTelemetry(rows)
    if (!record) throw ApiError.notFound('Telemetry record was not found.')
    res.json(record)
  } catch (err) {
    next(err)
  }
})

export default router
