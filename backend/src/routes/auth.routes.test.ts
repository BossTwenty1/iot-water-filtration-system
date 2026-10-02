// Regression coverage for the auth.routes.ts zod conversion (src/lib/validate.ts):
// asserts the 400-on-bad-shape path now comes from validateBody rather than
// the old manual `if (!email || !password)` checks, with the same client-
// visible error shape (errorHandler.ts is untouched by the conversion).
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

const { supabaseAnon } = vi.hoisted(() => ({
  supabaseAnon: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))
vi.mock('../config/supabaseClient', () => ({
  supabaseAnon,
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', email: 'user@example.com', full_name: 'Test', role: 'Viewer', status: 'Active' },
          }),
        })),
      })),
    })),
  },
  createScopedClient: vi.fn(),
}))

import authRoutes from './auth.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/auth', authRoutes)
  app.use(errorHandler)
  return app
}

beforeEach(() => {
  supabaseAnon.auth.signInWithPassword.mockReset()
  supabaseAnon.auth.signUp.mockReset()
})

describe('POST /auth/login validation', () => {
  it('returns 400 without ever calling Supabase when the body is missing password', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/login').send({ email: 'user@example.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body.')
    expect(supabaseAnon.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('returns 400 for a completely empty body', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/login').send({})
    expect(res.status).toBe(400)
  })

  it('passes a well-formed body through to Supabase', async () => {
    supabaseAnon.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'invalid' } })
    const res = await request(buildApp()).post('/api/v1/auth/login').send({ email: 'user@example.com', password: 'secret' })
    expect(supabaseAnon.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret' })
    expect(res.status).toBe(401) // no session -> unauthorized, proving it reached the handler past validation
  })
})

describe('POST /auth/register validation', () => {
  it('returns 400 when body has missing password or invalid email', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/register').send({ email: 'invalid-email' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body.')
    expect(supabaseAnon.auth.signUp).not.toHaveBeenCalled()
  })

  it('returns 400 when password is fewer than 6 characters', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/register').send({ email: 'user@example.com', password: '123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body.')
    expect(supabaseAnon.auth.signUp).not.toHaveBeenCalled()
  })

  it('successfully registers and returns 201 with session', async () => {
    const mockSession = {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      expires_in: 3600,
      user: { id: 'test-user-id', email: 'user@example.com' },
    }
    supabaseAnon.auth.signUp.mockResolvedValue({
      data: { user: mockSession.user, session: mockSession },
      error: null,
    })

    const res = await request(buildApp())
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com', password: 'Password123!', name: 'New User' })

    expect(supabaseAnon.auth.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password123!',
      options: {
        data: {
          full_name: 'New User',
          role: 'Viewer',
        },
      },
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBe('fake-access-token')
    expect(res.body.user.role).toBe('Viewer')
  })
})
