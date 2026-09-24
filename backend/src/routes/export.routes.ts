// GET /export/csv — CSV export for historical records.
//
// docs/API_ROUTES_DRAFT.md §8 proposed this endpoint but left both "which
// record types are exportable" and "CSV column order" as
// PENDING_DECISIONS.md §12 ("CSV column order" is explicitly still listed
// as open). The column sets below are therefore a placeholder, not a final
// contract — they reuse the same fields/vocabulary already returned by the
// equivalent JSON routes (telemetry/test-runs/alerts/laboratory-validation)
// so they're at least consistent with something already shipped, but the
// exact set/order should be revisited once that decision lands.
import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { orThrow, applyDateRange, type DateRangeQuery } from '../lib/queryHelpers'
import { toCsv, type CsvValue } from '../lib/csv'
import { categoryToParameter, positionToStage } from '../lib/mappers'
import type { AlertRow, LaboratoryValidationRecordRow, SensorReadingWithSensor, TestRunRow } from '../types/db'
import type { LaboratoryValidationResults } from '../types/domain'

const router = express.Router()

const EXPORT_ROW_LIMIT = 5000

interface ExportQuery extends DateRangeQuery {
  type?: string
  deviceId?: string
  testRunId?: string
}

async function buildTelemetryCsv(query: ExportQuery): Promise<string> {
  let builder = supabaseAdmin.from('sensor_readings').select('*, sensor:sensors!inner(category,position,unit)')
  builder = applyDateRange(builder, 'measured_at', query)
  if (query.deviceId) builder = builder.eq('device_id', query.deviceId)
  if (query.testRunId) builder = builder.eq('test_run_id', query.testRunId)
  builder = builder.order('measured_at', { ascending: false }).limit(EXPORT_ROW_LIMIT)

  const rows = orThrow(await builder, 'Failed to load telemetry for export.') as unknown as SensorReadingWithSensor[]
  const csvRows: CsvValue[][] = rows.map((row) => [
    row.measured_at,
    row.device_id,
    row.test_run_id,
    categoryToParameter(row.sensor?.category),
    positionToStage(row.sensor?.position),
    row.value,
    row.sensor?.unit ?? null,
    row.reading_status,
  ])
  return toCsv(['measuredAt', 'deviceId', 'testRunId', 'parameter', 'stage', 'value', 'unit', 'status'], csvRows)
}

async function buildTestRunsCsv(query: ExportQuery): Promise<string> {
  let builder = supabaseAdmin.from('test_runs').select('*')
  builder = applyDateRange(builder, 'started_at', query)
  if (query.deviceId) builder = builder.eq('device_id', query.deviceId)
  builder = builder.order('started_at', { ascending: false }).limit(EXPORT_ROW_LIMIT)

  const rows = orThrow<TestRunRow[]>(await builder, 'Failed to load test runs for export.')
  const csvRows: CsvValue[][] = rows.map((row) => [
    row.id,
    row.device_id,
    row.status,
    row.started_at,
    row.ended_at,
    row.target_volume_liters,
    row.notes,
  ])
  return toCsv(['id', 'deviceId', 'status', 'startedAt', 'endedAt', 'targetVolumeLiters', 'notes'], csvRows)
}

async function buildAlertsCsv(query: ExportQuery): Promise<string> {
  let builder = supabaseAdmin.from('alerts').select('*')
  builder = applyDateRange(builder, 'triggered_at', query)
  if (query.deviceId) builder = builder.eq('device_id', query.deviceId)
  builder = builder.order('triggered_at', { ascending: false }).limit(EXPORT_ROW_LIMIT)

  const rows = orThrow<AlertRow[]>(await builder, 'Failed to load alerts for export.')
  const csvRows: CsvValue[][] = rows.map((row) => [
    row.id,
    row.device_id,
    row.category,
    row.severity,
    row.status,
    row.source,
    row.title,
    row.message,
    row.triggered_at,
    row.acknowledged_at,
  ])
  return toCsv(
    ['id', 'deviceId', 'category', 'severity', 'status', 'source', 'title', 'message', 'triggeredAt', 'acknowledgedAt'],
    csvRows
  )
}

async function buildLabValidationCsv(query: ExportQuery): Promise<string> {
  let builder = supabaseAdmin.from('laboratory_validation_records').select('*')
  builder = applyDateRange(builder, 'validated_at', query)
  if (query.testRunId) builder = builder.eq('test_run_id', query.testRunId)
  builder = builder.order('validated_at', { ascending: false }).limit(EXPORT_ROW_LIMIT)

  const rows = orThrow<LaboratoryValidationRecordRow[]>(await builder, 'Failed to load laboratory validation records for export.')
  const csvRows: CsvValue[][] = rows.map((row) => {
    const results = (row.results as LaboratoryValidationResults | null) ?? {}
    return [
      row.id,
      row.test_run_id,
      row.sample_reference,
      row.validated_at,
      results.stage ?? null,
      results.parameter ?? null,
      results.referenceResult ?? null,
      results.sensorReading ?? null,
      results.unit ?? null,
      row.percentage_error,
      results.conclusion ?? null,
      results.notes ?? null,
    ]
  })
  return toCsv(
    ['id', 'testRunId', 'sampleReference', 'validatedAt', 'stage', 'parameter', 'referenceResult', 'sensorReading', 'unit', 'percentageError', 'conclusion', 'notes'],
    csvRows
  )
}

const BUILDERS: Record<string, (query: ExportQuery) => Promise<string>> = {
  telemetry: buildTelemetryCsv,
  'test-runs': buildTestRunsCsv,
  alerts: buildAlertsCsv,
  'laboratory-validation': buildLabValidationCsv,
}

// GET /export/csv?type=telemetry|test-runs|alerts|laboratory-validation
//                &from=&to=&deviceId=&testRunId=
router.get('/csv', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as ExportQuery
    const type = query.type
    const builder = type ? BUILDERS[type] : undefined
    if (!builder) throw ApiError.badRequest(`type must be one of: ${Object.keys(BUILDERS).join(', ')}.`)

    const csv = await builder(query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`)
    res.send(csv)
  } catch (err) {
    next(err)
  }
})

export default router
