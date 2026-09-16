import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../lib/apiError'

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, details: err.details })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Unexpected server error.' })
}
