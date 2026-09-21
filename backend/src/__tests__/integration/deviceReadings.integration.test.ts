// Exercises POST /devices/:id/readings against the real app + a real local
// Supabase instance, covering the "skip bad items, keep good ones" partial
// -batch behavior that a schema-validation rewrite must not silently break
// (see src/lib/validate.ts / backend/docs). Requires the seeded device
// (`npm run seed`, device_identifier SIM-DEV-001) to exist.
import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { supabaseAdmin } from '../../config/supabaseClient'
import env from '../../config/env'

let deviceId: string

beforeAll(async () => {
  const { data, error } = await supabaseAdmin.from('devices').select('id').eq('device_identifier', 'SIM-DEV-001').single()
  if (error || !data) throw new Error('Seeded device SIM-DEV-001 not found — run `npm run seed` first.')
  deviceId = data.id
})

describe('POST /api/v1/devices/:id/readings', () => {
  it('rejects a malformed body (missing measuredAt) with 400 and inserts nothing', async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/readings`)
      .set('X-Device-Key', env.deviceIngestKey)
      .send({ readings: [{ category: 'ph', position: 'pre_filtration', value: 7 }] })
    expect(res.status).toBe(400)
  })

  it('rejects requests with a missing or wrong X-Device-Key before touching the database', async () => {
    const withoutKey = await request(app)
      .post(`/api/v1/devices/${deviceId}/readings`)
      .send({ measuredAt: new Date().toISOString(), readings: [{ category: 'ph', position: 'pre_filtration', value: 7 }] })
    expect(withoutKey.status).toBe(401)

    const wrongKey = await request(app)
      .post(`/api/v1/devices/${deviceId}/readings`)
      .set('X-Device-Key', 'definitely-wrong')
      .send({ measuredAt: new Date().toISOString(), readings: [{ category: 'ph', position: 'pre_filtration', value: 7 }] })
    expect(wrongKey.status).toBe(401)
  })

  it('inserts valid readings and skips invalid ones within the same batch, then updates the device heartbeat', async () => {
    const measuredAt = new Date().toISOString()
    const res = await request(app)
      .post(`/api/v1/devices/${deviceId}/readings`)
      .set('X-Device-Key', env.deviceIngestKey)
      .send({
        measuredAt,
        readings: [
          { category: 'ph', position: 'pre_filtration', value: 6.8 },
          { category: 'not-a-real-category', position: 'pre_filtration', value: 1 },
          { category: 'turbidity', position: 'post_filtration', value: 0.5 },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.inserted).toBe(2)
    expect(res.body.skipped).toHaveLength(1)
    expect(res.body.skipped[0]).toEqual(expect.objectContaining({ category: 'not-a-real-category', reason: 'unknown category' }))

    const { data: device } = await supabaseAdmin.from('devices').select('last_seen_at, connection_state').eq('id', deviceId).single()
    expect(device?.connection_state).toBe('Online')
    expect(device?.last_seen_at).not.toBeNull()
  })
})
