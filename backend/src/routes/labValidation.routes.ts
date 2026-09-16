import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, type PaginationQuery } from '../lib/queryHelpers'
import { toLaboratoryValidationRecord } from '../lib/mappers'
import type { LaboratoryValidationResults } from '../types/domain'
import type { LaboratoryValidationRecordRow } from '../types/db'
import type { Json } from '../types/database.types'

const router = express.Router()

interface LabValidationListQuery extends PaginationQuery {
  testRunId?: string
}

// Standard percentage-error definition. The exact convention this project
// wants (signed vs. absolute, rounding) is still TBD per
// docs/PENDING_DECISIONS.md §12 — this is only a placeholder so the column
// isn't left empty; it is not a confirmed lab-validation formula.
function percentageError(referenceResult?: number | null, sensorReading?: number | null): number | null {
  if (referenceResult === undefined || referenceResult === null || referenceResult === 0) return null
  if (sensorReading === undefined || sensorReading === null) return null
  return Math.abs((sensorReading - referenceResult) / referenceResult) * 100
}

// GET /laboratory-validation — list.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as LabValidationListQuery
    const { limit, offset } = parsePagination(query)
    let builder = supabaseAdmin.from('laboratory_validation_records').select('*')
    if (query.testRunId) builder = builder.eq('test_run_id', query.testRunId)
    builder = builder.order('validated_at', { ascending: false }).range(offset, offset + limit - 1)

    const rows = orThrow<LaboratoryValidationRecordRow[]>(await builder, 'Failed to load laboratory validation records.')
    res.json(rows.map(toLaboratoryValidationRecord))
  } catch (err) {
    next(err)
  }
})

// GET /laboratory-validation/:id — detail.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<LaboratoryValidationRecordRow | null>(
      await supabaseAdmin.from('laboratory_validation_records').select('*').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load laboratory validation record.'
    )
    if (!row) throw ApiError.notFound('Laboratory validation record was not found.')
    res.json(toLaboratoryValidationRecord(row))
  } catch (err) {
    next(err)
  }
})

// POST /laboratory-validation — create. Body accepts CreateLaboratoryValidationRecordInput
// (testRunId, sampleId, referenceResult) plus optional stage/parameter/sensorReading/unit/notes.
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testRunId, sampleId, referenceResult, stage, parameter, sensorReading, unit, conclusion, notes } = req.body ?? {}
    if (!testRunId || !sampleId) throw ApiError.badRequest('testRunId and sampleId are required.')

    const results: LaboratoryValidationResults = { stage, parameter, referenceResult, sensorReading, unit, conclusion, notes }
    const row = orThrow<LaboratoryValidationRecordRow | null>(
      await supabaseAdmin
        .from('laboratory_validation_records')
        .insert({
          test_run_id: testRunId,
          sample_reference: sampleId,
          results: results as unknown as Json,
          percentage_error: percentageError(referenceResult, sensorReading),
        })
        .select('*')
        .single(),
      'Failed to create laboratory validation record.'
    )
    if (!row) throw ApiError.badRequest('Failed to create laboratory validation record.')
    res.status(201).json(toLaboratoryValidationRecord(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /laboratory-validation/:id/result — attach/update referenceResult
// once the external lab result arrives.
router.patch('/:id/result', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceResult, conclusion } = req.body ?? {}
    if (referenceResult === undefined) throw ApiError.badRequest('referenceResult is required.')

    const existing = orThrow<LaboratoryValidationRecordRow | null>(
      await supabaseAdmin.from('laboratory_validation_records').select('*').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load laboratory validation record.'
    )
    if (!existing) throw ApiError.notFound('Laboratory validation record was not found.')

    const existingResults = (existing.results as LaboratoryValidationResults | null) ?? {}
    const results: LaboratoryValidationResults = { ...existingResults, referenceResult, conclusion: conclusion ?? existingResults.conclusion }
    const row = orThrow<LaboratoryValidationRecordRow | null>(
      await supabaseAdmin
        .from('laboratory_validation_records')
        .update({ results: results as unknown as Json, percentage_error: percentageError(referenceResult, existingResults.sensorReading) })
        .eq('id', param(req, 'id'))
        .select('*')
        .single(),
      'Failed to update laboratory validation record.'
    )
    if (!row) throw ApiError.notFound('Laboratory validation record was not found.')
    res.json(toLaboratoryValidationRecord(row))
  } catch (err) {
    next(err)
  }
})

export default router
