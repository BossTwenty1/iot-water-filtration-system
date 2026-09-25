import type { Request } from 'express'
import { ApiError } from './apiError'

// @types/express-serve-static-core types route params as `string | string[]`
// (repeated params come back as an array) and, with noUncheckedIndexedAccess,
// as possibly `undefined` too. Every route here uses single, always-present
// path segments (`/:id`), so this narrows that back down to a plain string
// and turns a missing/malformed param into a proper 400 instead of an `any`.
export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string') throw ApiError.badRequest(`Missing path parameter: ${name}`)
  return value
}
