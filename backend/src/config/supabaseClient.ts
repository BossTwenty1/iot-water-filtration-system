import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import env from './env'
import type { Database } from '../types/database.types'

// supabase-js always spins up a Realtime client, which needs a global
// WebSocket constructor. This backend never subscribes to Realtime channels,
// but Node 20 (this project's runtime) has no built-in WebSocket, so we still
// have to supply one — Node 22+ wouldn't need this. `ws`'s WebSocket type
// doesn't structurally match lib.dom's (different `onerror` event type), so
// this is typed loosely rather than fighting that mismatch for a value that
// never actually gets used (no Realtime channel is ever opened).
const realtimeOptions: Record<string, unknown> = { transport: WebSocket }

// Service-role client: used for all server-side reads/writes. No RLS policies
// exist yet (see backend/docs/SCHEMA_TBD_LOG.md), so this is currently
// equivalent in access to the anon client, but it's the correct client to use
// once RLS lands — trusted server code should not depend on anon policies.
export const supabaseAdmin = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: realtimeOptions,
})

// Anon client: used only to validate end-user JWTs and perform
// password-based auth flows (login/refresh/password reset), mirroring what a
// browser client would do.
export const supabaseAnon = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: realtimeOptions,
})

// A client scoped to one user's access token, for auth operations (signOut,
// updateUser) that must act as that user rather than the service role.
export function createScopedClient(accessToken: string) {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: realtimeOptions,
  })
}
