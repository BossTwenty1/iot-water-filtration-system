import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('dotenv/config', () => ({}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('API port configuration', () => {
  it.each([
    ['10000', '3000', 10000],
    [undefined, '4000', 4000],
    [undefined, undefined, 3000],
    ['invalid', '4000', 4000],
  ])('uses PORT=%s, BACKEND_PORT=%s to select %s', async (port, backendPort, expected) => {
    vi.stubEnv('PORT', port)
    vi.stubEnv('BACKEND_PORT', backendPort)
    vi.resetModules()
    const { default: env } = await import('./env')
    expect(env.port).toBe(expected)
  })
})
