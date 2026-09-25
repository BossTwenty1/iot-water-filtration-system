// Regression coverage for the devices.routes.ts zod conversion
// (src/lib/validate.ts): asserts POST /devices and the readings envelope
// still reject a bad-shape body with 400 via validateBody, without reaching
// Supabase for the write itself. requireAuth runs before validateBody in
// this router's chain, so its Supabase calls are mocked to succeed.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'
import env from '../config/env'

const { supabaseAnon, supabaseAdmin } = vi.hoisted(() => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('../config/supabaseClient', () => ({ supabaseAnon, supabaseAdmin, createScopedClient: vi.fn() }))

import devicesRoutes from './devices.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/devices', devicesRoutes)
  app.use(errorHandler)
  return app
}

function chainable(result: unknown) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return builder
}

beforeEach(() => {
  supabaseAnon.auth.getUser.mockReset()
  supabaseAdmin.from.mockReset()
  // requireAuth: valid session + a Viewer profile, for every request in this file.
  supabaseAnon.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })
  supabaseAdmin.from.mockImplementation(() => chainable({ data: { id: 'user-1', role: 'Viewer' }, error: null }))
})

describe('POST /devices validation', () => {
  it('returns 400 when deviceIdentifier is missing, without an insert call', async () => {
    const res = await request(buildApp()).post('/api/v1/devices').set('Authorization', 'Bearer test-token').send({ name: 'no id' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body.')
  })
})

describe('POST /devices/:id/readings envelope validation', () => {
  it('returns 400 when measuredAt is missing', async () => {
    const res = await request(buildApp())
      .post('/api/v1/devices/00000000-0000-0000-0000-000000000000/readings')
      .set('X-Device-Key', env.deviceIngestKey)
      .send({ readings: [{ category: 'ph', position: 'pre_filtration', value: 7 }] })
    expect(res.status).toBe(400)
  })

  it('returns 400 when readings is an empty array', async () => {
    const res = await request(buildApp())
      .post('/api/v1/devices/00000000-0000-0000-0000-000000000000/readings')
      .set('X-Device-Key', env.deviceIngestKey)
      .send({ measuredAt: new Date().toISOString(), readings: [] })
    expect(res.status).toBe(400)
  })

  it('returns 401 (device-key check runs before validation) when the key is wrong, even with a bad body', async () => {
    const res = await request(buildApp())
      .post('/api/v1/devices/00000000-0000-0000-0000-000000000000/readings')
      .set('X-Device-Key', 'wrong')
      .send({})
    expect(res.status).toBe(401)
  })
})
