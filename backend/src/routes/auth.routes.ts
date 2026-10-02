import express, { type Request, type Response, type NextFunction } from 'express'
import type { Session } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAnon, supabaseAdmin, createScopedClient } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { toUser } from '../lib/mappers'
import { validateBody } from '../lib/validate'
import type { AuthSession } from '../types/domain'

const router = express.Router()

const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) })
const registerSchema = z.object({
  email: z.string().email({ message: 'Must be a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  name: z.string().optional(),
})
const refreshSchema = z.object({ refreshToken: z.string().min(1) })
const passwordResetRequestSchema = z.object({ email: z.string().min(1) })
const passwordResetConfirmSchema = z.object({ accessToken: z.string().min(1), newPassword: z.string().min(1) })

async function sessionResponse(session: Session): Promise<AuthSession> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', session.user.id).maybeSingle()

  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: toUser(profile ?? { id: session.user.id, email: session.user.email ?? null }),
  }
}

// POST /auth/register — public account registration (defaults to Viewer role).
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name ?? null,
          role: 'Viewer',
        },
      },
    })

    if (error || !data.user) {
      throw ApiError.badRequest('Could not create account.', error?.message)
    }

    if (data.session) {
      res.status(201).json(await sessionResponse(data.session))
      return
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
    res.status(201).json({
      user: toUser(profile ?? { id: data.user.id, email: data.user.email ?? null }),
      message: 'Registration successful.',
    })
  } catch (err) {
    next(err)
  }
})

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
// Optional flow; SMTP/mail provider is not part of this project's approved
// scope, so this depends on whatever Supabase Auth email config is active.
router.post('/password-reset/request', validateBody(passwordResetRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    await supabaseAnon.auth.resetPasswordForEmail(email)
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

    const { error } = await createScopedClient(accessToken).auth.updateUser({ password: newPassword })
    if (error) throw ApiError.badRequest('Could not update password.', error.message)

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
