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
// profile row (role/status/name) to req.profile. Every protected route in
// this API only requires a valid, authenticated user — see
// docs/API_REFERENCE.md "Authentication" for why per-role gating is not
// enforced yet (PENDING_DECISIONS §9 leaves roles/permissions unresolved).
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
