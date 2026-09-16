import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, applyDateRange, type DateRangeQuery, type PaginationQuery } from '../lib/queryHelpers'
import { pollAndStream } from '../lib/sse'
import env from '../config/env'
import { toAlert } from '../lib/mappers'
import type { AlertRow } from '../types/db'
import type { SystemAlert } from '../types/domain'

const router = express.Router()

interface AlertListQuery extends PaginationQuery, DateRangeQuery {
  severity?: string
  status?: string
  source?: string
}

function applyAlertFilters(builder: any, query: AlertListQuery) {
  let result = applyDateRange(builder, 'triggered_at', query)
  if (query.severity) result = result.eq('severity', query.severity)
  if (query.status) result = result.eq('status', query.status)
  if (query.source) result = result.ilike('source', `%${query.source}%`)
  return result
}

async function transitionAlert(id: string, toStatus: 'Acknowledged' | 'Resolved', changedBy: string): Promise<AlertRow> {
  const { data: current } = await supabaseAdmin.from('alerts').select('*').eq('id', id).maybeSingle()
  if (!current) throw ApiError.notFound('Alert was not found.')

  const patch: Partial<AlertRow> = { status: toStatus }
  if (toStatus === 'Acknowledged') {
    patch.acknowledged_at = new Date().toISOString()
    patch.acknowledged_by = changedBy
  }

  const updated = orThrow<AlertRow | null>(
    await supabaseAdmin.from('alerts').update(patch).eq('id', id).select('*').single(),
    'Failed to update alert.'
  )
  if (!updated) throw ApiError.notFound('Alert was not found.')

  await supabaseAdmin.from('alert_state_changes').insert({
    alert_id: id,
    from_status: current.status,
    to_status: toStatus,
    changed_by: changedBy,
  })

  return updated
}

// GET /alerts — list; query params severity, status, source, from, to.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as AlertListQuery
    const { limit, offset } = parsePagination(query)
    let builder = supabaseAdmin.from('alerts').select('*')
    builder = applyAlertFilters(builder, query)
    builder = builder.order('triggered_at', { ascending: false }).range(offset, offset + limit - 1)

    const rows = orThrow(await builder, 'Failed to load alerts.')
    res.json(rows.map(toAlert))
  } catch (err) {
    next(err)
  }
})

// GET /alerts/stream — SSE push of new alerts as they fire.
router.get('/stream', requireAuth, (req: Request, res: Response) => {
  pollAndStream<AlertRow, SystemAlert[]>({
    req,
    res,
    event: 'alert',
    cursorField: 'triggered_at',
    intervalMs: env.ssePollIntervalMs,
    fetchLatest: async (since) =>
      orThrow(
        await supabaseAdmin.from('alerts').select('*').gt('triggered_at', since).order('triggered_at', { ascending: true }),
        'Failed to poll alerts.'
      ),
    transform: (rows) => rows.map(toAlert),
  })
})

// GET /alerts/:id — detail.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow(await supabaseAdmin.from('alerts').select('*').eq('id', param(req, 'id')).maybeSingle(), 'Failed to load alert.')
    if (!row) throw ApiError.notFound('Alert was not found.')
    res.json(toAlert(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /alerts/:id/acknowledge — status -> Acknowledged.
router.patch('/:id/acknowledge', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await transitionAlert(param(req, 'id'), 'Acknowledged', (req.profile as { id: string }).id)
    res.json(toAlert(updated))
  } catch (err) {
    next(err)
  }
})

// PATCH /alerts/:id/resolve — status -> Resolved.
router.patch('/:id/resolve', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await transitionAlert(param(req, 'id'), 'Resolved', (req.profile as { id: string }).id)
    res.json(toAlert(updated))
  } catch (err) {
    next(err)
  }
})

export default router
