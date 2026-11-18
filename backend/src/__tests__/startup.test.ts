import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  watchdog: vi.fn(),
  retention: vi.fn(),
}))

vi.mock('dotenv/config', () => ({}))
vi.mock('../app', () => ({ default: { listen: mocks.listen } }))
vi.mock('../lib/deviceWatchdog', () => ({ startDeviceWatchdog: mocks.watchdog }))
vi.mock('../lib/retentionJob', () => ({ startRetentionJob: mocks.retention }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.resetModules()
})

describe('background job startup', () => {
  it.each([undefined, '', 'false', 'TRUE', 'True', '1', ' true ', 'true'])(
    'only enables jobs for the exact value true (received %s)',
    async (value) => {
      vi.stubEnv('BACKGROUND_JOBS_ENABLED', value)
      await import('../../index')

      const { default: env } = await import('../config/env')
      expect(env.backgroundJobsEnabled).toBe(value === 'true')
      expect(mocks.listen).toHaveBeenCalledTimes(1)
      expect(mocks.listen).toHaveBeenCalledWith(env.port, expect.any(Function))
      expect(mocks.watchdog).toHaveBeenCalledTimes(value === 'true' ? 1 : 0)
      expect(mocks.retention).toHaveBeenCalledTimes(value === 'true' ? 1 : 0)
    },
  )
})
