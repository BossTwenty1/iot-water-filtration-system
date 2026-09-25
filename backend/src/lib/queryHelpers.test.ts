import { describe, expect, it, vi } from 'vitest'
import { applyDateRange, orThrow, parsePagination } from './queryHelpers'
import { ApiError } from './apiError'

describe('parsePagination', () => {
  it('uses defaults when limit/offset are absent', () => {
    expect(parsePagination({})).toEqual({ limit: 100, offset: 0 })
  })

  it('honors custom defaultLimit/maxLimit', () => {
    expect(parsePagination({}, { defaultLimit: 20, maxLimit: 50 })).toEqual({ limit: 20, offset: 0 })
  })

  it('caps limit at maxLimit', () => {
    expect(parsePagination({ limit: '10000' }, { maxLimit: 500 })).toEqual({ limit: 500, offset: 0 })
  })

  it('clamps a negative offset to 0', () => {
    expect(parsePagination({ offset: '-5' })).toEqual({ limit: 100, offset: 0 })
  })

  it('parses valid numeric strings', () => {
    expect(parsePagination({ limit: '25', offset: '50' })).toEqual({ limit: 25, offset: 50 })
  })
})

describe('applyDateRange', () => {
  it('calls gte only when `from` is present', () => {
    const builder = { gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis() }
    applyDateRange(builder, 'measured_at', { from: '2026-01-01' })
    expect(builder.gte).toHaveBeenCalledWith('measured_at', '2026-01-01')
    expect(builder.lte).not.toHaveBeenCalled()
  })

  it('calls lte only when `to` is present', () => {
    const builder = { gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis() }
    applyDateRange(builder, 'measured_at', { to: '2026-02-01' })
    expect(builder.lte).toHaveBeenCalledWith('measured_at', '2026-02-01')
    expect(builder.gte).not.toHaveBeenCalled()
  })

  it('calls neither when both are absent', () => {
    const builder = { gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis() }
    applyDateRange(builder, 'measured_at', {})
    expect(builder.gte).not.toHaveBeenCalled()
    expect(builder.lte).not.toHaveBeenCalled()
  })
})

describe('orThrow', () => {
  it('returns data on success', () => {
    expect(orThrow({ data: [1, 2, 3], error: null }, 'failed')).toEqual([1, 2, 3])
  })

  it('throws an ApiError wrapping the Postgrest error on failure', () => {
    const pgError = { message: 'boom', details: '', hint: '', code: '', name: 'PostgrestError' } as import('@supabase/supabase-js').PostgrestError
    expect(() => orThrow({ data: null, error: pgError }, 'failed to load')).toThrow(ApiError)
    try {
      orThrow({ data: null, error: pgError }, 'failed to load')
    } catch (err) {
      expect((err as ApiError).status).toBe(500)
      expect((err as ApiError).message).toBe('failed to load')
    }
  })
})
