import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export interface Env {
  port: number
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  corsOrigin: string
  ssePollIntervalMs: number
}

const env: Env = {
  port: Number(process.env.BACKEND_PORT) || 3000,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  ssePollIntervalMs: Number(process.env.SSE_POLL_INTERVAL_MS) || 3000,
}

export default env
