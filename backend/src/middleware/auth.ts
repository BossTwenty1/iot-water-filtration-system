import type { NextFunction, Request, Response } from 'express'
import { supabaseAnon, supabaseAdmin } from '../config/supabaseClient'
import { ApiError } from '../lib/apiError'
import { hasPermission, isRole, routePermission, type Permission } from '../lib/permissions'
import type { ProfileRow } from '../types/db'

declare global {
  namespace Express {
    interface Request { authToken?: string; profile?: ProfileRow }
  }
}
export async function activeProfile(id: string): Promise<ProfileRow> {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw ApiError.serviceUnavailable('Account verification is unavailable. Please try again.')
  if (!data || data.status !== 'Active' || !isRole(data.role)) throw ApiError.unauthorized('This account is inactive or unavailable. Contact an administrator.')
  return data
}
export async function verifySession(token: string): Promise<ProfileRow> {
  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data.user) throw ApiError.unauthorized('Invalid or expired session.')
  return activeProfile(data.user.id)
}
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '')
    if (!match?.[1]) throw ApiError.unauthorized('Missing bearer token.')
    req.profile = await verifySession(match[1])
    req.authToken = match[1]
    const permission = routePermission(req.method === 'HEAD' ? 'GET' : req.method, req.originalUrl)
    if (!permission || !hasPermission(req.profile.role, permission)) throw ApiError.forbidden()
    next()
  } catch (error) { next(error) }
}
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!hasPermission(req.profile?.role, permission)) { next(ApiError.forbidden()); return }
    next()
  }
}
