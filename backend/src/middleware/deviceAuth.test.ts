import { describe, expect, it, vi } from 'vitest'
import type { Request } from 'express'
import { requireDeviceKey } from './deviceAuth'
import { ApiError } from '../lib/apiError'
import env from '../config/env'

// Read the actual configured value rather than assuming setup.ts's dummy
// fallback applied — a real backend/.env (if present locally) takes
// precedence over it, per src/__tests__/setup.ts.
const VALID_KEY = env.deviceIngestKey

function reqWithHeader(value: unknown): Request {
  return { headers: { 'x-device-key': value } } as unknown as Request
}

describe('requireDeviceKey', () => {
  it('calls next() with no error when the key matches', () => {
    const next = vi.fn()
    requireDeviceKey(reqWithHeader(VALID_KEY), {} as never, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('calls next(ApiError.unauthorized) when the key is wrong', () => {
    const next = vi.fn()
    requireDeviceKey(reqWithHeader('wrong-key'), {} as never, next)
    expect(next).toHaveBeenCalledWith(expect.any(ApiError))
    const err = next.mock.calls[0]![0] as ApiError
    expect(err.status).toBe(401)
  })

  it('calls next(ApiError.unauthorized) when the header is missing', () => {
    const next = vi.fn()
    requireDeviceKey(reqWithHeader(undefined), {} as never, next)
    expect(next).toHaveBeenCalledWith(expect.any(ApiError))
  })

  it('rejects a different-length key without throwing (timingSafeEqual length guard)', () => {
    const next = vi.fn()
    expect(() => requireDeviceKey(reqWithHeader('short'), {} as never, next)).not.toThrow()
    expect(next).toHaveBeenCalledWith(expect.any(ApiError))
  })
})
