import type { NextFunction, Request, Response } from 'express'
import { supabaseAnon, supabaseAdmin } from '../config/supabaseClient'
import { ApiError } from '../lib/apiError'
import type { ProfileRow } from '../types/db'

function extractToken(req: Request): string | null {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authToken?: string
      profile?: Pick<ProfileRow, 'id'> & Partial<ProfileRow>
    }
  }
}

// Verifies the bearer token with Supabase Auth and attaches the caller's
// profile row (role/status/name) to req.profile. Almost every protected
// route in this API only requires a valid, authenticated user — see
// docs/API_REFERENCE.md "Authentication" for why full per-role gating is
// not enforced (PENDING_DECISIONS.md "user authorization" leaves the
// permissions matrix unresolved). `requireRole` below is a narrow
// exception for the account-management routes only.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req)
    if (!token) throw ApiError.unauthorized('Missing bearer token.')

    const { data, error } = await supabaseAnon.auth.getUser(token)
    if (error || !data?.user) throw ApiError.unauthorized('Invalid or expired session.')

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).maybeSingle()

    req.authToken = token
    req.profile = profile ?? { id: data.user.id, email: data.user.email ?? null, role: 'Viewer', status: 'Active' }
    next()
  } catch (err) {
    next(err)
  }
}

// Gates a route to specific `profiles.role` values. This is deliberately
// narrow — it is NOT the full permissions matrix from PENDING_DECISIONS.md
// ("user authorization", still unresolved), which would need to decide who
// may call every route in this API. It exists only to close an obvious
// self-escalation hole: today any authenticated user (including a
// freshly-created 'Viewer') can call the account-management routes in
// src/routes/users.routes.ts, including granting themselves 'Administrator'.
// Must run after `requireAuth` (reads `req.profile`).
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.profile?.role || !roles.includes(req.profile.role)) {
      next(ApiError.forbidden(`This action requires one of these roles: ${roles.join(', ')}.`))
      return
    }
    next()
  }
}
