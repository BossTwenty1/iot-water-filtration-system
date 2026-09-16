import express, { type Request, type Response, type NextFunction } from 'express'
import type { Session } from '@supabase/supabase-js'
import { supabaseAnon, supabaseAdmin, createScopedClient } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { toUser } from '../lib/mappers'
import type { AuthSession } from '../types/domain'

const router = express.Router()

async function sessionResponse(session: Session): Promise<AuthSession> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', session.user.id).maybeSingle()

  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: toUser(profile ?? { id: session.user.id, email: session.user.email ?? null }),
  }
}

// POST /auth/login — email/password → session token + user profile.
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) throw ApiError.badRequest('email and password are required.')

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw ApiError.unauthorized('Invalid email or password.')

    res.json(await sessionResponse(data.session))
  } catch (err) {
    next(err)
  }
})

// POST /auth/logout — invalidate the caller's current session.
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createScopedClient(req.authToken as string).auth.signOut()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// GET /auth/me — current user profile.
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json(toUser(req.profile as NonNullable<Request['profile']>))
})

// POST /auth/refresh — refresh access token.
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body ?? {}
    if (!refreshToken) throw ApiError.badRequest('refreshToken is required.')

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw ApiError.unauthorized('Refresh token is invalid or expired.')

    res.json(await sessionResponse(data.session))
  } catch (err) {
    next(err)
  }
})

// POST /auth/password-reset/request — send a reset-password email.
// Optional flow; SMTP/mail provider is not part of this project's approved
// scope, so this depends on whatever Supabase Auth email config is active.
router.post('/password-reset/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body ?? {}
    if (!email) throw ApiError.badRequest('email is required.')
    await supabaseAnon.auth.resetPasswordForEmail(email)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /auth/password-reset/confirm — set a new password using the token
// from the reset email link.
router.post('/password-reset/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken, newPassword } = req.body ?? {}
    if (!accessToken || !newPassword) throw ApiError.badRequest('accessToken and newPassword are required.')

    const { error } = await createScopedClient(accessToken).auth.updateUser({ password: newPassword })
    if (error) throw ApiError.badRequest('Could not update password.', error.message)

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
