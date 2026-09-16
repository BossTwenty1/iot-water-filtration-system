import type { PostgrestError } from '@supabase/supabase-js'

export class ApiError extends Error {
  readonly status: number
  readonly details?: string

  constructor(status: number, message: string, details?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }

  static badRequest(message: string, details?: string): ApiError {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = 'Authentication is required.'): ApiError {
    return new ApiError(401, message)
  }

  static forbidden(message = 'You do not have permission to perform this action.'): ApiError {
    return new ApiError(403, message)
  }

  static notFound(message = 'Resource was not found.'): ApiError {
    return new ApiError(404, message)
  }

  static fromSupabase(error: PostgrestError | null, fallbackMessage = 'Database request failed.'): ApiError | null {
    if (!error) return null
    return new ApiError(500, fallbackMessage, error.message)
  }
}
