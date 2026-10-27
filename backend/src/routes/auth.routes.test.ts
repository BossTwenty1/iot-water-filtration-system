// Regression coverage for the auth.routes.ts zod conversion (src/lib/validate.ts):
// asserts the 400-on-bad-shape path now comes from validateBody rather than
// the old manual `if (!email || !password)` checks, with the same client-
// visible error shape (errorHandler.ts is untouched by the conversion).
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'

const { supabaseAnon, passwordClient, updateUser, createPasswordChangeClient } = vi.hoisted(() => ({
  supabaseAnon: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getUser: vi.fn(),
    },
  },
  updateUser: vi.fn(),
  passwordClient: { auth: { signInWithPassword: vi.fn(), updateUser: vi.fn() } },
  createPasswordChangeClient: vi.fn(),
}))
createPasswordChangeClient.mockImplementation(() => passwordClient)
passwordClient.auth.updateUser = updateUser
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
  createPasswordChangeClient,
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
  supabaseAnon.auth.getUser.mockReset()
  updateUser.mockReset()
  passwordClient.auth.signInWithPassword.mockReset()
  createPasswordChangeClient.mockClear()
})

describe('POST /auth/change-password', () => {
  const path = '/api/v1/auth/change-password'
  const body = { currentPassword: 'old-password', newPassword: 'new-password' }

  beforeEach(() => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id', email: 'user@example.com' } }, error: null })
    passwordClient.auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'fresh-token' }, user: { id: 'test-user-id' } }, error: null })
  })

  it('requires a bearer token', async () => {
    const res = await request(buildApp()).post(path).send(body)
    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('does not accept a token in the URL', async () => {
    const res = await request(buildApp()).post(`${path}?token=user-token`).send(body)
    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a missing current password or a short new password', async () => {
    for (const invalidBody of [{ newPassword: 'new-password' }, { currentPassword: 'old-password', newPassword: '123' }]) {
      const res = await request(buildApp()).post(path).set('Authorization', 'Bearer user-token').send(invalidBody)
      expect(res.status).toBe(400)
    }
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates only the authenticated user with the current password', async () => {
    updateUser.mockResolvedValue({ error: null })
    const res = await request(buildApp()).post(path).set('Authorization', 'Bearer user-token').send(body)
    expect(res.status).toBe(204)
    expect(createPasswordChangeClient).toHaveBeenCalledOnce()
    expect(passwordClient.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'old-password' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password', current_password: 'old-password' })
  })

  it('rejects an incorrect current password before attempting an update', async () => {
    passwordClient.auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } })
    const res = await request(buildApp()).post(path).set('Authorization', 'Bearer user-token').send(body)
    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects credentials belonging to a different account', async () => {
    passwordClient.auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'other-token' }, user: { id: 'other-user-id' } }, error: null })
    const res = await request(buildApp()).post(path).set('Authorization', 'Bearer user-token').send(body)
    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('does not report success when Supabase rejects the current password', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Incorrect current password' } })
    const res = await request(buildApp()).post(path).set('Authorization', 'Bearer user-token').send(body)
    expect(res.status).toBe(400)
  })
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
