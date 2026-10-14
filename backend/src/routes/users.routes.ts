import express, { type Request } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { canManageAccount } from '../lib/permissions'
import { ApiError } from '../lib/apiError'
import { param } from '../lib/params'
import { orThrow } from '../lib/queryHelpers'
import { toUser } from '../lib/mappers'
import { validateBody } from '../lib/validate'
import type { ProfileRow } from '../types/db'

const router = express.Router()
const managedRole = z.enum(['Administrator', 'Researcher', 'Viewer'])
const createSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(128), role: managedRole }).strict()
const roleSchema = z.object({ role: managedRole }).strict()
const statusSchema = z.object({ status: z.enum(['Active', 'Inactive']) }).strict()
const filtersSchema = z.object({ search: z.string().trim().max(120).optional(), role: z.enum(['Super Administrator','Administrator','Researcher','Viewer']).optional(), status: z.enum(['Active','Inactive']).optional() })

function userPagination(req: Request) {
  const schema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(1_000_000).default(0) })
  const parsed = schema.safeParse(req.query)
  if (!parsed.success) throw ApiError.badRequest('Invalid user pagination.')
  return parsed.data
}
function targetId(req: Request): string {
  const result = z.string().uuid().safeParse(param(req, 'id'))
  if (!result.success) throw ApiError.badRequest('Invalid user ID.')
  return result.data
}
function visibleUser(row: ProfileRow) {
  return { ...toUser(row), deletionPending: 'deletion_requested_by' in row && Boolean(row.deletion_requested_by) }
}
async function accountMutation(req: Request, id: string, action: string, value?: string) {
  const { data, error } = await supabaseAdmin.rpc('manage_account', { p_actor_id: req.profile!.id, p_target_id: id, p_action: action, p_value: value ?? null })
  if (error?.code === '42501') throw ApiError.forbidden('Account management denied. Refresh the directory and check permitted roles or pending deletion.')
  if (error?.code === 'P0002') throw ApiError.notFound('User was not found.')
  if (error?.code === '22023') throw ApiError.badRequest('Invalid account role, status or action.')
  if (error || !data || typeof data !== 'object' || Array.isArray(data) || !('id' in data)) throw ApiError.serviceUnavailable('Account update could not be confirmed. Refresh before retrying.')
  return data as unknown as ProfileRow
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { limit, offset } = userPagination(req)
    const parsed = filtersSchema.safeParse(req.query)
    if (!parsed.success) throw ApiError.badRequest('Invalid user filters.')
    const { search, role, status } = parsed.data
    let query = supabaseAdmin.from('profiles').select('*').order('created_at').order('id')
    if (req.profile!.role === 'Administrator') query = query.in('role', ['Researcher','Viewer'])
    if (role) query = query.eq('role', role)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('email', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    const rows = orThrow(await query.range(offset, offset + limit - 1), 'Failed to load users.')
    res.json(rows.map(visibleUser))
  } catch (error) { next(error) }
})

router.get('/audit', requireAuth, async (req, res, next) => {
  try {
    const { limit, offset } = userPagination(req)
    const rows = orThrow(await supabaseAdmin.from('account_audit').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + limit - 1), 'Failed to load account audit history.')
    res.json(rows)
  } catch (error) { next(error) }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = orThrow<ProfileRow | null>(await supabaseAdmin.from('profiles').select('*').eq('id', targetId(req)).maybeSingle(), 'Failed to load user.')
    if (!row) throw ApiError.notFound('User was not found.')
    if (req.profile!.role === 'Administrator' && !['Researcher','Viewer'].includes(row.role ?? '')) throw ApiError.forbidden()
    res.json(visibleUser(row))
  } catch (error) { next(error) }
})

router.post('/', requireAuth, validateBody(createSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body as z.infer<typeof createSchema>
    if (!canManageAccount(req.profile!, { id: 'new-account', role }, role)) throw ApiError.forbidden()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
    if (error || !data.user) throw ApiError.badRequest('Could not create account. Check the email and Supabase password policy.')
    try {
      const row = await accountMutation(req, data.user.id, 'create', role)
      res.status(201).json(visibleUser(row))
    } catch {
      // Creation spans Auth and PostgreSQL; never activate without audited finalization.
      throw ApiError.serviceUnavailable('Auth account created but activation was not confirmed. Refresh the directory; an administrator must review the inactive account before retrying.')
    }
  } catch (error) { next(error) }
})

router.patch('/:id/role', requireAuth, validateBody(roleSchema), async (req, res, next) => {
  try { res.json(visibleUser(await accountMutation(req, targetId(req), 'role', req.body.role))) } catch (error) { next(error) }
})
router.patch('/:id/status', requireAuth, validateBody(statusSchema), async (req, res, next) => {
  try { res.json(visibleUser(await accountMutation(req, targetId(req), 'status', req.body.status))) } catch (error) { next(error) }
})
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = targetId(req)
    await accountMutation(req, id, 'delete')
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) throw ApiError.serviceUnavailable('Deletion could not be confirmed. The account remains blocked pending deletion; refresh and retry.')
    res.status(204).send()
  } catch (error) { next(error) }
})
export default router
