import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler, notFoundHandler } from './errorHandler'
import { ApiError } from '../lib/apiError'

function mockRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res as Response
}

describe('errorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('responds with an ApiError instance\'s own status and message/details', () => {
    const res = mockRes()
    errorHandler(ApiError.badRequest('bad input', 'field y'), {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'bad input', details: 'field y' })
  })

  it('maps a connectivity error code on err.code to 503', () => {
    const res = mockRes()
    const err = Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' })
    errorHandler(err, {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('temporarily unreachable'), details: 'ECONNREFUSED' })
    )
  })

  it('maps a connectivity error code nested under err.cause.code to 503', () => {
    const res = mockRes()
    const err = Object.assign(new Error('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
    errorHandler(err, {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ details: 'UND_ERR_CONNECT_TIMEOUT' }))
  })

  it('falls back to a generic 500 for a plain error and logs it', () => {
    const res = mockRes()
    const err = new Error('something broke')
    errorHandler(err, {} as Request, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unexpected server error.' })
    expect(consoleErrorSpy).toHaveBeenCalledWith(err)
  })
})

describe('notFoundHandler', () => {
  it('responds 404 with the method and path in the message', () => {
    const res = mockRes()
    notFoundHandler({ method: 'GET', originalUrl: '/api/v1/nope' } as Request, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'No route matches GET /api/v1/nope' })
  })
})
