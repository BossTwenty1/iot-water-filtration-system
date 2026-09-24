import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, type PaginationQuery } from '../lib/queryHelpers'
import { toMaintenanceRecord, toMaintenanceReminder } from '../lib/mappers'
import type { MaintenanceRecordWithPerformer, MaintenanceReminderRow } from '../types/db'

const router = express.Router()
const RECORD_SELECT = '*, performer:profiles(full_name,email)'

interface MaintenanceRecordListQuery extends PaginationQuery {
  component?: string
  type?: string
  status?: string
}

// GET /maintenance/records — list; query params component, type, status.
router.get('/records', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as MaintenanceRecordListQuery
    const { limit, offset } = parsePagination(query)
    let builder = supabaseAdmin.from('maintenance_records').select(RECORD_SELECT)
    if (query.component) builder = builder.ilike('component', `%${query.component}%`)
    if (query.type) builder = builder.eq('type', query.type)
    if (query.status) builder = builder.eq('status', query.status)
    builder = builder.order('occurred_at', { ascending: false }).range(offset, offset + limit - 1)

    const rows = orThrow(await builder, 'Failed to load maintenance records.') as unknown as MaintenanceRecordWithPerformer[]
    res.json(rows.map(toMaintenanceRecord))
  } catch (err) {
    next(err)
  }
})

// POST /maintenance/records — create.
router.post('/records', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { component, notes, type, description } = req.body ?? {}
    if (!component) throw ApiError.badRequest('component is required.')

    const row = orThrow(
      await supabaseAdmin
        .from('maintenance_records')
        .insert({
          component,
          type: type ?? 'Inspection',
          description: description ?? `${type ?? 'Inspection'} record created.`,
          status: 'Completed',
          performed_by: (req.profile as { id: string }).id,
          notes: notes?.trim() || 'No parts or materials recorded.',
        })
        .select(RECORD_SELECT)
        .single(),
      'Failed to create maintenance record.'
    ) as unknown as MaintenanceRecordWithPerformer
    res.status(201).json(toMaintenanceRecord(row))
  } catch (err) {
    next(err)
  }
})

// GET /maintenance/reminders — list.
router.get('/reminders', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = orThrow(
      await supabaseAdmin.from('maintenance_reminders').select('*').order('due_date', { ascending: true }),
      'Failed to load maintenance reminders.'
    )
    res.json(rows.map(toMaintenanceReminder))
  } catch (err) {
    next(err)
  }
})

// POST /maintenance/reminders — create.
router.post('/reminders', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { component, label, dueDate, status } = req.body ?? {}
    if (!component || !label || !dueDate) throw ApiError.badRequest('component, label and dueDate are required.')

    const row = orThrow<MaintenanceReminderRow | null>(
      await supabaseAdmin
        .from('maintenance_reminders')
        .insert({ component, label, due_date: dueDate, status: status ?? 'Upcoming' })
        .select('*')
        .single(),
      'Failed to create maintenance reminder.'
    )
    if (!row) throw ApiError.badRequest('Failed to create maintenance reminder.')
    res.status(201).json(toMaintenanceReminder(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /maintenance/reminders/:id/dismiss — mark handled.
router.patch('/reminders/:id/dismiss', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<MaintenanceReminderRow | null>(
      await supabaseAdmin
        .from('maintenance_reminders')
        .update({ status: 'Dismissed', dismissed_at: new Date().toISOString() })
        .eq('id', param(req, 'id'))
        .select('*')
        .maybeSingle(),
      'Failed to dismiss maintenance reminder.'
    )
    if (!row) throw ApiError.notFound('Maintenance reminder was not found.')
    res.json(toMaintenanceReminder(row))
  } catch (err) {
    next(err)
  }
})

export default router
