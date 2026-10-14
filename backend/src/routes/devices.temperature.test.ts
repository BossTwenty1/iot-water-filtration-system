// Synthetic contract check only: every Supabase call and alert side effect is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import env from '../config/env'
import { errorHandler } from '../middleware/errorHandler'

const { from, insert, update } = vi.hoisted(() => ({
  from: vi.fn(), insert: vi.fn(), update: vi.fn(),
}))
vi.mock('../config/supabaseClient', () => ({ supabaseAdmin: { from } }))
vi.mock('../lib/alertEngine', () => ({ evaluateReadingsForAlerts: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/deviceWatchdog', () => ({ resolveOfflineAlertIfActive: vi.fn().mockResolvedValue(undefined) }))
import devicesRoutes from './devices.routes'

const deviceId = '11111111-1111-4111-8111-111111111111'
const measuredAt = '2026-10-14T00:00:00Z'
const app = express()
app.use(express.json())
app.use('/api/v1/devices', devicesRoutes)
app.use(errorHandler)

function chain(data: unknown) {
  const result = { data, error: null }
  const builder: any = {
    select: () => builder, eq: () => builder,
    insert: (rows: unknown) => { insert(rows); return builder },
    update: (patch: unknown) => { update(patch); return builder },
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  from.mockImplementation((table: string) => {
    if (table === 'devices') return chain({ id: deviceId, device_identifier: 'SYNTHETIC-TEST-ONLY' })
    if (table === 'sensors') return chain([{ id: 'synthetic-temperature', category: 'temperature', position: 'pre_filtration' }])
    if (table === 'sensor_readings') return chain([{ id: 'synthetic-reading' }])
    throw new Error(`Unexpected table ${table}`)
  })
})

function send(value: number | null, status: string, position = 'pre_filtration', key = env.deviceIngestKey) {
  return request(app).post(`/api/v1/devices/${deviceId}/readings`).set('X-Device-Key', key)
    .send({ measuredAt, readings: [{ category: 'temperature', position, value, status }] })
}

describe('temperature-only firmware contract', () => {
  it.each([[30.625, 'valid'], [null, 'fault']] as const)('preserves %s / %s without inventing other channels', async (value, status) => {
    const res = await send(value, status)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ deviceId, inserted: 1, skipped: [] })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith([{
      sensor_id: 'synthetic-temperature', device_id: deviceId, value,
      reading_status: status, measured_at: measuredAt, test_run_id: null,
    }])
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ connection_state: 'Online' }))
  })
  it('rejects the wrong key before any database call', async () => {
    expect((await send(30.625, 'valid', 'pre_filtration', 'incorrect')).status).toBe(401)
    expect(from).not.toHaveBeenCalled()
  })
  it('does not invent a sensor at the other filtration stage', async () => {
    const res = await send(30.625, 'valid', 'post_filtration')
    expect(res.status).toBe(400)
    expect(res.body.skipped[0].reason).toBe('sensor not registered for this device')
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
