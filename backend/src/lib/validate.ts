import type { ZodType } from 'zod'
import type { NextFunction, Request, Response } from 'express'
import { ApiError } from './apiError'

// Wraps a zod schema as request-body middleware, feeding a failure into the
// *existing* ApiError/errorHandler flow unchanged — validation failure is
// just another 400 ApiError, so no client-visible error-shape change.
// Colocate schemas at the top of each route file (matching this codebase's
// existing inline-interface style) rather than a shared schemas directory,
// so each route's validation conversion stays a small, self-contained diff.
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(ApiError.badRequest('Invalid request body.', result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')))
      return
    }
    req.body = result.data
    next()
  }
}
