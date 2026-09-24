import { vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'

type Result<T> = { data: T; error: null } | { data: null; error: PostgrestError }

export function ok<T>(data: T): Result<T> {
  return { data, error: null }
}

export function fail(message: string): Result<null> {
  return { data: null, error: { message, details: '', hint: '', code: '', name: 'PostgrestError' } as PostgrestError }
}

// A chainable stub covering the subset of the Supabase query-builder surface
// this codebase calls: .select().eq().order().limit().maybeSingle()/.single(),
// .insert(), .update(), .delete(), and direct `await` on a list query. Every
// non-terminal method returns the same builder, so a chain of any length
// resolves to the one configured `result`; terminal methods (`.then`,
// `.maybeSingle()`, `.single()`) settle the promise.
export function chainable<T>(result: Result<T>) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    gte: () => builder,
    lte: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (value: Result<T>) => unknown, reject?: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

// Mimics `supabaseAdmin`/`supabaseAnon`'s shape enough to stand in for
// `vi.mock('../config/supabaseClient', ...)`: `.from(table)` is a `vi.fn()`
// a test drives with `mockReturnValueOnce(chainable(ok(...)))` per call, in
// the exact order the code under test issues them.
export function createSupabaseMock() {
  return { from: vi.fn() }
}
