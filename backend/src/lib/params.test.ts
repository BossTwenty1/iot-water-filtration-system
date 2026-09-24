import { describe, expect, it } from 'vitest'
import type { Request } from 'express'
import { param } from './params'
import { ApiError } from './apiError'

function reqWithParams(params: Record<string, unknown>): Request {
  return { params } as unknown as Request
}

describe('param', () => {
  it('returns the string value when present', () => {
    expect(param(reqWithParams({ id: 'abc-123' }), 'id')).toBe('abc-123')
  })

  it('throws a 400 ApiError when the param is missing', () => {
    expect(() => param(reqWithParams({}), 'id')).toThrow(ApiError)
    try {
      param(reqWithParams({}), 'id')
    } catch (err) {
      expect((err as ApiError).status).toBe(400)
    }
  })

  it('throws a 400 ApiError when the param is array-shaped (repeated param)', () => {
    expect(() => param(reqWithParams({ id: ['a', 'b'] }), 'id')).toThrow(ApiError)
  })
})
