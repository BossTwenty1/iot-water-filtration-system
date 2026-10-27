import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const { config, from } = vi.hoisted(() => ({
  config: { corsOrigin: 'http://localhost:5173' },
  from: vi.fn(() => { throw new Error('Database access is blocked in CORS tests.') }),
}))
vi.mock('./config/env', () => ({ default: config }))
vi.mock('./config/supabaseClient', () => ({ supabaseAdmin: { from } }))
vi.mock('./routes', () => ({ default: express.Router() }))

afterEach(() => {
  expect(from).not.toHaveBeenCalled()
  vi.clearAllMocks()
})

async function appFor(origin: string) {
  config.corsOrigin = origin
  vi.resetModules()
  return (await import('./app')).default
}

describe('exact frontend CORS origins', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173'])('allows both loopback hosts when %s is configured', async (configured) => {
    const app = await appFor(configured)
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await request(app).options('/api/v1/auth/login')
        .set('Origin', origin).set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
      expect(response.status).toBe(204)
      expect(response.headers['access-control-allow-origin']).toBe(origin)
      expect(response.headers['access-control-allow-headers']).toBe('authorization,content-type')
      expect(response.headers.vary).toContain('Origin')
    }
  })

  it('does not allow unrelated origins, other ports or deceptive loopback names', async () => {
    const app = await appFor('http://localhost:5173')
    for (const origin of ['https://untrusted.example', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:5173.untrusted.example', 'null']) {
      const response = await request(app).get('/api/v1/health').set('Origin', origin)
      expect(response.status).toBe(200)
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    }
  })

  it('supports configured comma-separated origins without enabling loopback in production', async () => {
    const app = await appFor('https://dashboard.example, https://preview.example ')
    for (const origin of ['https://dashboard.example', 'https://preview.example']) {
      const response = await request(app).get('/api/v1/health').set('Origin', origin)
      expect(response.headers['access-control-allow-origin']).toBe(origin)
    }
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await request(app).get('/api/v1/health').set('Origin', origin)
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    }
    expect((await request(app).get('/api/v1/health')).status).toBe(200)
  })
})
