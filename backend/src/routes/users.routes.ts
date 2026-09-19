import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth, requireRole } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow, parsePagination, type PaginationQuery } from '../lib/queryHelpers'
import { toUser } from '../lib/mappers'

const router = express.Router()

// GET /users — list.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = parsePagination(req.query as PaginationQuery)
    const rows = orThrow(
      await supabaseAdmin.from('profiles').select('*').order('created_at').range(offset, offset + limit - 1),
      'Failed to load users.'
    )
    res.json(rows.map(toUser))
  } catch (err) {
    next(err)
  }
})

// GET /users/:id — detail.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow(await supabaseAdmin.from('profiles').select('*').eq('id', param(req, 'id')).maybeSingle(), 'Failed to load user.')
    if (!row) throw ApiError.notFound('User was not found.')
    res.json(toUser(row))
  } catch (err) {
    next(err)
  }
})

// POST /users — create (provisions a Supabase Auth user + profile row).
// Administrator-only: the caller picks the new user's role, so this is as
// much a privilege-granting action as PATCH .../role below.
router.post('/', requireAuth, requireRole('Administrator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body ?? {}
    if (!email || !password) throw ApiError.badRequest('email and password are required.')

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    })
    if (error) throw ApiError.badRequest('Failed to create user.', error.message)

    const row = orThrow(
      await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).maybeSingle(),
      'Failed to load newly created user.'
    )
    res.status(201).json(toUser(row as NonNullable<typeof row>))
  } catch (err) {
    next(err)
  }
})

// PATCH /users/:id/role — update role. Administrator-only — without this,
// any authenticated user (including a freshly-created 'Viewer') could grant
// themselves 'Administrator'.
router.patch('/:id/role', requireAuth, requireRole('Administrator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body ?? {}
    if (!role) throw ApiError.badRequest('role is required.')

    const row = orThrow(
      await supabaseAdmin.from('profiles').update({ role }).eq('id', param(req, 'id')).select('*').maybeSingle(),
      'Failed to update role.'
    )
    if (!row) throw ApiError.notFound('User was not found.')
    res.json(toUser(row))
  } catch (err) {
    next(err)
  }
})

// PATCH /users/:id/status — update Active/Inactive. App-level flag only —
// it does not (yet) suspend the underlying Supabase Auth account, since
// enforcement policy is TBD (docs/PENDING_DECISIONS.md). Administrator-only:
// deactivating another account is a privilege-sensitive action.
router.patch('/:id/status', requireAuth, requireRole('Administrator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body ?? {}
    if (!status) throw ApiError.badRequest('status is required.')

    const row = orThrow(
      await supabaseAdmin.from('profiles').update({ status }).eq('id', param(req, 'id')).select('*').maybeSingle(),
      'Failed to update status.'
    )
    if (!row) throw ApiError.notFound('User was not found.')
    res.json(toUser(row))
  } catch (err) {
    next(err)
  }
})

// DELETE /users/:id — remove a user (and their profile, via cascade).
// Administrator-only — deleting an account is not something any
// authenticated user should be able to do to any other account.
router.delete('/:id', requireAuth, requireRole('Administrator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(param(req, 'id'))
    if (error) throw ApiError.notFound('User was not found.')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
