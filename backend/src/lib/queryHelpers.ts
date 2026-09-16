import type { PostgrestError } from '@supabase/supabase-js'
import { ApiError } from './apiError'

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: PostgrestError }

// Throws a uniform ApiError if a Supabase call returned an error, otherwise
// returns `data` so call sites can do: const rows = orThrow(await query, 'msg')
//
// IMPORTANT: for a `.select().order()`-style (array) response, T is inferred
// correctly from `await query`. For a `.single()`/`.maybeSingle()` response,
// this TypeScript toolchain does not reliably infer T (it collapses to
// `never` silently — verified in isolation while converting this codebase to
// TS) — always pass an explicit type argument for those:
// `orThrow<Row | null>(await query.maybeSingle(), 'msg')`. A `never` here
// doesn't crash anything (every type is assignable *to* `never`'s use sites
// that don't touch a property), but it silently defeats the type-checking
// this conversion was meant to add, so don't skip the explicit generic.
export function orThrow<T>(result: SupabaseResult<T>, fallbackMessage: string): T {
  if (result.error) throw ApiError.fromSupabase(result.error, fallbackMessage)
  return result.data
}

export interface PaginationQuery {
  limit?: string
  offset?: string
}

// Shared list pagination: ?limit=&offset= with sane defaults/caps.
export function parsePagination(
  query: PaginationQuery,
  { defaultLimit = 100, maxLimit = 500 }: { defaultLimit?: number; maxLimit?: number } = {}
): { limit: number; offset: number } {
  const limit = Math.min(Number(query.limit) || defaultLimit, maxLimit)
  const offset = Math.max(Number(query.offset) || 0, 0)
  return { limit, offset }
}

export interface DateRangeQuery {
  from?: string
  to?: string
}

// Applies ?from=&to= as an inclusive range filter on the given timestamp
// column. `builder` is a Supabase PostgrestFilterBuilder — typed as a
// generic passthrough rather than reproducing its full generic signature,
// since every `.gte`/`.lte` call here returns the same builder type.
export function applyDateRange<T extends { gte: Function; lte: Function }>(builder: T, column: string, query: DateRangeQuery): T {
  let result = builder
  if (query.from) result = (result as any).gte(column, query.from)
  if (query.to) result = (result as any).lte(column, query.to)
  return result
}
