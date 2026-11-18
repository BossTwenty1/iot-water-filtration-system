import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'
import env from '../config/env'

const { resetEmail, getUser, scopedClient, profileLookup } = vi.hoisted(() => ({
  resetEmail: vi.fn(), getUser: vi.fn(), scopedClient: vi.fn(), profileLookup: vi.fn(),
}))
vi.mock('../config/supabaseClient', () => ({
  supabaseAnon: { auth: { resetPasswordForEmail: resetEmail } },
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: profileLookup }) }) }) },
  createScopedClient: scopedClient,
}))
import authRoutes from './auth.routes'

const app = express()
app.use(express.json())
app.use('/api/v1/auth', authRoutes)
app.use(errorHandler)
const fetchMock = vi.fn()
const validBody = { accessToken: 'recovery-token', newPassword: 'New-password-123!' }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  resetEmail.mockResolvedValue({ error: null })
  getUser.mockResolvedValue({ data: { user: { id: 'recovered-user' } }, error: null })
  scopedClient.mockReturnValue({ auth: { getUser } })
  profileLookup.mockResolvedValue({ data: { id: 'recovered-user', status: 'Active', role: 'Viewer' }, error: null })
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
})
afterEach(() => vi.unstubAllGlobals())

describe('password reset request', () => {
  it.each(['existing@example.com', 'unknown@example.com'])('returns the same empty success for %s', async email => {
    const response = await request(app).post('/api/v1/auth/password-reset/request').send({ email })
    expect(response.status).toBe(204)
    expect(response.text).toBe('')
  })
  it('trims email and uses only the server-configured redirect', async () => {
    await request(app).post('/api/v1/auth/password-reset/request').send({ email: ' user@example.com ', redirectTo: 'https://untrusted.example' })
    expect(resetEmail).toHaveBeenCalledWith('user@example.com', { redirectTo: env.passwordResetRedirectUrl })
  })
  it.each([{}, { email: 'invalid' }])('rejects invalid email before calling the provider', async body => {
    expect((await request(app).post('/api/v1/auth/password-reset/request').send(body)).status).toBe(400)
    expect(resetEmail).not.toHaveBeenCalled()
  })
  it.each([429, 500])('handles provider status %i without exposing provider details', async status => {
    resetEmail.mockResolvedValue({ error: { status, message: 'private provider details' } })
    const response = await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'user@example.com' })
    expect(response.status).toBe(status === 429 ? 429 : 503)
    expect(response.text).not.toContain('private provider details')
  })
})

describe('password reset confirmation', () => {
  it('does not change a password for an inactive account', async () => {
    profileLookup.mockResolvedValue({ data: { id: 'recovered-user', status: 'Inactive', role: 'Viewer' }, error: null })
    expect((await request(app).post('/api/v1/auth/password-reset/confirm').send(validBody)).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([{}, { ...validBody, accessToken: '' }, { ...validBody, newPassword: 'short' }])('rejects invalid input before any Auth call', async body => {
    expect((await request(app).post('/api/v1/auth/password-reset/confirm').send(body)).status).toBe(400)
    expect(scopedClient).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('verifies the recovery token and updates only its account without an old password or admin key', async () => {
    const response = await request(app).post('/api/v1/auth/password-reset/confirm').send(validBody)
    expect(response.status).toBe(204)
    expect(scopedClient).toHaveBeenCalledWith(validBody.accessToken)
    expect(getUser).toHaveBeenCalledWith(validBody.accessToken)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${env.supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: env.supabaseAnonKey, Authorization: 'Bearer recovery-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: validBody.newPassword }),
    })
  })
  it('rejects an invalid token without attempting a password update', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
    expect((await request(app).post('/api/v1/auth/password-reset/confirm').send(validBody)).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('keeps a provider outage separate from an expired token', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } })
    expect((await request(app).post('/api/v1/auth/password-reset/confirm').send(validBody)).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([
    [422, 'weak_password', 400, 'stronger'], [422, 'same_password', 400, 'different'],
    [401, 'bad_jwt', 401, 'expired'], [503, 'unexpected_failure', 503, 'try again'], [429, 'over_request_rate_limit', 429, 'wait'],
  ])('handles update error %i %s', async (status, code, expected, message) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code }), { status: Number(status) }))
    const response = await request(app).post('/api/v1/auth/password-reset/confirm').send(validBody)
    expect(response.status).toBe(expected)
    expect(response.body.error).toContain(message)
  })
})
