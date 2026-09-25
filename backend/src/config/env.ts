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
  deviceIngestKey: string
  deviceWatchdogIntervalMs: number
  deviceOfflineTimeoutMs: number
  retentionJobIntervalMs: number
}

const env: Env = {
  port: Number(process.env.BACKEND_PORT) || 3000,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  ssePollIntervalMs: Number(process.env.SSE_POLL_INTERVAL_MS) || 3000,
  // Shared-secret placeholder for device ingestion auth — see
  // src/middleware/deviceAuth.ts. Not a resolution of the real device-auth
  // decision (docs/PENDING_DECISIONS.md).
  deviceIngestKey: required('DEVICE_INGEST_KEY'),
  // How often src/lib/deviceWatchdog.ts checks for devices that have gone
  // quiet, and how long since last_seen_at counts as "offline". Both are
  // implementation-detail timings (like ssePollIntervalMs above), not the
  // client-facing timing decisions still open in PENDING_DECISIONS.md
  // (sampling interval, save interval, cycle logic).
  deviceWatchdogIntervalMs: Number(process.env.DEVICE_WATCHDOG_INTERVAL_MS) || 10_000,
  deviceOfflineTimeoutMs: Number(process.env.DEVICE_OFFLINE_TIMEOUT_MS) || 30_000,
  // How often src/lib/retentionJob.ts checks data_retention_policy and
  // purges old sensor_readings. No-ops entirely while retention_days is
  // unset (today's default) — see PUT /data-retention.
  retentionJobIntervalMs: Number(process.env.RETENTION_JOB_INTERVAL_MS) || 24 * 60 * 60 * 1000,
}

export default env
