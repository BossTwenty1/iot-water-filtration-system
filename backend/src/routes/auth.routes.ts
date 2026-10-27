import express, { type Request, type Response, type NextFunction } from 'express'
import type { Session } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAnon, supabaseAdmin, createScopedClient } from '../config/supabaseClient'
import { activeProfile, requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { toUser } from '../lib/mappers'
import { validateBody } from '../lib/validate'
import type { AuthSession } from '../types/domain'
import env from '../config/env'

const router = express.Router()

const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) })
const refreshSchema = z.object({ refreshToken: z.string().min(1) })
const passwordResetRequestSchema = z.object({ email: z.string().trim().email() })
const passwordResetConfirmSchema = z.object({ accessToken: z.string().trim().min(1), newPassword: z.string().min(6) })

async function sessionResponse(session: Session): Promise<AuthSession> {
  const profile = await activeProfile(session.user.id)

  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: toUser(profile),
  }
}

// POST /auth/login — email/password → session token + user profile.
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body

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
    // The request-scoped client has no stored Auth session. Revoke the verified
    // caller's session explicitly; never invalidate another user's sessions.
    const { error } = await supabaseAdmin.auth.admin.signOut(req.authToken as string, 'local')
    if (error) throw ApiError.serviceUnavailable('Session revocation failed. Please try again.')
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
router.post('/refresh', validateBody(refreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw ApiError.unauthorized('Refresh token is invalid or expired.')

    res.json(await sessionResponse(data.session))
  } catch (err) {
    next(err)
  }
})

// POST /auth/password-reset/request — send a reset-password email.
// The redirect is server configuration, never a URL supplied by the caller.
// Supabase returns the same result for registered and unknown addresses.
router.post('/password-reset/request', validateBody(passwordResetRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo: env.passwordResetRedirectUrl })
    if (error?.status === 429) throw new ApiError(429, 'Please wait before requesting another reset link.')
    if (error) throw ApiError.serviceUnavailable('We could not send a reset email. Please try again later.')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /auth/password-reset/confirm — set a new password using the token
// from the reset email link.
router.post('/password-reset/confirm', validateBody(passwordResetConfirmSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken, newPassword } = req.body

    const client = createScopedClient(accessToken)
    const { data, error: tokenError } = await client.auth.getUser(accessToken)
    if (tokenError && (!tokenError.status || tokenError.status >= 500)) throw ApiError.serviceUnavailable('We could not check your reset link. Please try again.')
    if (tokenError || !data.user) throw ApiError.unauthorized('This reset link has expired or is not valid. Please request a new link.')
    await activeProfile(data.user.id)

    // auth.updateUser requires a stored SDK session. This flow holds only the
    // recovery access token, so call the same Auth endpoint with that token.
    const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { code?: string }
      if (response.status === 429) throw new ApiError(429, 'Please wait before trying again.')
      if (response.status >= 500) throw ApiError.serviceUnavailable('Could not update your password. Please try again.')
      if (response.status === 401 || response.status === 403) throw ApiError.unauthorized('This reset link has expired or is not valid. Please request a new link.')
      if (error.code === 'weak_password') throw ApiError.badRequest('Choose a stronger password and try again.')
      if (error.code === 'same_password') throw ApiError.badRequest('Choose a different password from your old one.')
      throw ApiError.badRequest('Could not update your password. Please try again or request a new reset link.')
    }

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
