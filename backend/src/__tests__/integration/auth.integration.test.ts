// Exercises POST /auth/login against the real app + a real local Supabase
// Auth instance. Requires the seeded admin user (`npm run seed`) to exist.
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../app'

const SEED_ADMIN_EMAIL = 'seed-admin@aquasense.test'
const SEED_ADMIN_PASSWORD = 'SeedTest123!'

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with a token and user profile for correct credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.token).toEqual(expect.any(String))
    expect(res.body.user.email).toBe(SEED_ADMIN_EMAIL)
    expect(res.body.user.role).toBe('Administrator')
  })

  it('returns 401 for a wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: SEED_ADMIN_EMAIL, password: 'wrong-password' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: SEED_ADMIN_EMAIL })
    expect(res.status).toBe(400)
  })
})
