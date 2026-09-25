import { describe, expect, it } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { ApiError } from './apiError'

describe('ApiError factories', () => {
  it('badRequest sets status 400 and carries the message/details', () => {
    const err = ApiError.badRequest('bad body', 'field x missing')
    expect(err.status).toBe(400)
    expect(err.message).toBe('bad body')
    expect(err.details).toBe('field x missing')
  })

  it('unauthorized defaults to a standard message at status 401', () => {
    const err = ApiError.unauthorized()
    expect(err.status).toBe(401)
    expect(err.message).toBe('Authentication is required.')
  })

  it('forbidden defaults to a standard message at status 403', () => {
    const err = ApiError.forbidden()
    expect(err.status).toBe(403)
    expect(err.message).toBe('You do not have permission to perform this action.')
  })

  it('notFound defaults to a standard message at status 404', () => {
    const err = ApiError.notFound()
    expect(err.status).toBe(404)
    expect(err.message).toBe('Resource was not found.')
  })

  it('serviceUnavailable defaults to a standard message at status 503', () => {
    const err = ApiError.serviceUnavailable()
    expect(err.status).toBe(503)
    expect(err.message).toContain('temporarily unreachable')
  })
})

describe('ApiError.fromSupabase', () => {
  it('returns null when there is no error', () => {
    expect(ApiError.fromSupabase(null)).toBeNull()
  })

  it('wraps a PostgrestError as a 500 with the fallback message and original details', () => {
    const pgError = { message: 'duplicate key', details: '', hint: '', code: '23505', name: 'PostgrestError' } as PostgrestError
    const err = ApiError.fromSupabase(pgError, 'Failed to insert row.')
    expect(err).not.toBeNull()
    expect(err?.status).toBe(500)
    expect(err?.message).toBe('Failed to insert row.')
    expect(err?.details).toBe('duplicate key')
  })
})
