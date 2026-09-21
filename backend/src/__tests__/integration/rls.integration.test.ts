// Exercises supabase/migrations/20260919090000_enable_rls.sql against a real
// local Postgres instance — this can't be meaningfully mocked, the point is
// verifying actual policy behavior. Requires the local Supabase stack
// running (`npx supabase start && npx supabase db reset`).
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { supabaseAdmin } from '../../config/supabaseClient'
import env from '../../config/env'

// A plain anon client, not the app's own `supabaseAnon`, to avoid depending
// on any app-level assumption about how that client is configured. Still
// needs a WebSocket transport supplied on Node 20 (see the same note in
// src/config/supabaseClient.ts) even though this client never opens a
// Realtime channel.
const anon = createClient(env.supabaseUrl, env.supabaseAnonKey, { realtime: { transport: WebSocket as never } })

describe('Row-Level Security (deny-by-default, no policies yet)', () => {
  it('an unauthenticated read on devices returns empty, not an error', async () => {
    const { data, error } = await anon.from('devices').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('an unauthenticated read on alerts returns empty, not an error', async () => {
    const { data, error } = await anon.from('alerts').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('an unauthenticated read on profiles returns empty, not an error', async () => {
    const { data, error } = await anon.from('profiles').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('an unauthenticated insert is rejected', async () => {
    const { error } = await anon
      .from('devices')
      .insert({ device_identifier: `rls-test-${Date.now()}`, name: 'should not be allowed' })
    expect(error).not.toBeNull()
  })

  it('the service-role client (BYPASSRLS) still reads real rows unaffected by RLS', async () => {
    const { data, error } = await supabaseAdmin.from('devices').select('*').eq('device_identifier', 'SIM-DEV-001')
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })
})
