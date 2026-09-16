import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import env from '../config/env'
import { ApiError } from '../lib/apiError'

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Placeholder device-ingestion auth: a shared secret sent as `X-Device-Key`.
// A device has no Supabase user session, so `requireAuth` doesn't apply —
// but the one write route reachable without a user login shouldn't be wide
// open either. This is *not* a resolution of the real device-authentication
// decision (docs/PENDING_DECISIONS.md §8), just enough to not leave
// POST /devices/:id/readings unguarded until that's decided.
export function requireDeviceKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-device-key']
  if (typeof provided !== 'string' || !timingSafeEqualStrings(provided, env.deviceIngestKey)) {
    next(ApiError.unauthorized('Missing or invalid X-Device-Key header.'))
    return
  }
  next()
}
