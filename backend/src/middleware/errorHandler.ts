import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../lib/apiError'

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` })
}

// R-07 ("Internet/cloud dependency during demo") — a Supabase call that
// fails at the network level (cloud unreachable) throws before it ever
// returns a PostgrestError, so it reaches here as a raw fetch failure rather
// than an ApiError. Recognizing that shape distinguishes "cloud is down" from
// an actual server bug: the client gets a 503 (retryable) instead of a
// generic 500, matching the frontend's stale/offline resource states instead
// of a hard error.
const CONNECTIVITY_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT'])

function connectivityErrorCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } } | undefined)?.cause
  const code = cause?.code ?? (err as { code?: string } | undefined)?.code
  return typeof code === 'string' && CONNECTIVITY_ERROR_CODES.has(code) ? code : undefined
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, details: err.details })
    return
  }
  const connectivityCode = connectivityErrorCode(err)
  if (connectivityCode) {
    console.error('Upstream connectivity failure:', connectivityCode)
    res.status(503).json({ error: 'The cloud service is temporarily unreachable. Please try again shortly.', details: connectivityCode })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Unexpected server error.' })
}
