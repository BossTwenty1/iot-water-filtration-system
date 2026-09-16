import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, type PaginationQuery } from '../lib/queryHelpers'
import { hydrateTestRun } from '../lib/testRunHydrator'
import type { TestRunRow } from '../types/db'

const router = express.Router()

interface TestRunListQuery extends PaginationQuery {
  deviceId?: string
  status?: string
}

// GET /test-runs — list.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as TestRunListQuery
    const { limit, offset } = parsePagination(query)
    let builder = supabaseAdmin.from('test_runs').select('*')
    if (query.deviceId) builder = builder.eq('device_id', query.deviceId)
    if (query.status) builder = builder.eq('status', query.status)
    builder = builder.order('started_at', { ascending: false }).range(offset, offset + limit - 1)

    const rows = orThrow<TestRunRow[]>(await builder, 'Failed to load test runs.')
    res.json(await Promise.all(rows.map(hydrateTestRun)))
  } catch (err) {
    next(err)
  }
})

// GET /test-runs/:id — detail.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<TestRunRow | null>(
      await supabaseAdmin.from('test_runs').select('*').eq('id', param(req, 'id')).maybeSingle(),
      'Failed to load test run.'
    )
    if (!row) throw ApiError.notFound('Test run was not found.')
    res.json(await hydrateTestRun(row))
  } catch (err) {
    next(err)
  }
})

// POST /test-runs — create.
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sampleInformation, notes, deviceId } = req.body ?? {}
    let targetDeviceId: string | undefined = deviceId
    if (!targetDeviceId) {
      const defaultDevice = orThrow<{ id: string } | null>(
        await supabaseAdmin.from('devices').select('id').limit(1).maybeSingle(),
        'Failed to resolve a default device.'
      )
      targetDeviceId = defaultDevice?.id
    }
    if (!targetDeviceId) throw ApiError.badRequest('deviceId is required (no devices exist yet).')

    const row = orThrow<TestRunRow | null>(
      await supabaseAdmin
        .from('test_runs')
        .insert({
          device_id: targetDeviceId,
          status: 'In Progress',
          notes: notes?.trim() || sampleInformation?.trim() || 'Research session created.',
        })
        .select('*')
        .single(),
      'Failed to create test run.'
    )
    if (!row) throw ApiError.badRequest('Failed to create test run.')
    res.status(201).json(await hydrateTestRun(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-runs/:id/complete — end run.
router.patch('/:id/complete', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<TestRunRow | null>(
      await supabaseAdmin
        .from('test_runs')
        .update({ status: 'Completed', ended_at: new Date().toISOString() })
        .eq('id', param(req, 'id'))
        .select('*')
        .maybeSingle(),
      'Failed to complete test run.'
    )
    if (!row) throw ApiError.notFound('Test run was not found.')
    res.json(await hydrateTestRun(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-runs/:id/notes — update notes field.
router.patch('/:id/notes', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notes } = req.body ?? {}
    if (typeof notes !== 'string') throw ApiError.badRequest('notes must be a string.')

    const row = orThrow<TestRunRow | null>(
      await supabaseAdmin.from('test_runs').update({ notes }).eq('id', param(req, 'id')).select('*').maybeSingle(),
      'Failed to update test run notes.'
    )
    if (!row) throw ApiError.notFound('Test run was not found.')
    res.json(await hydrateTestRun(row))
  } catch (err) {
    next(err)
  }
})

export default router
