// A standing process that behaves like a real ESP32 device: it POSTs a
// reading batch to `POST /devices/:id/readings` over HTTP on an interval,
// authenticated with `X-Device-Key`, instead of writing straight into the
// database like `seedTestData.ts` does. This lets the dashboard's "live"
// surfaces (SSE streams, SensorGrid) be exercised the same way real
// hardware will eventually drive them. See docs/tracker/todo.md → "Live
// simulator".
//
// Usage: `npm run simulate` (from backend/), after `npx supabase start`
// and with the API server running (`npm run dev`).
// Optional: `LIVE_SIM_INTERVAL_MS=2000 npm run simulate` to change the
// posting interval (default 5000ms). Stop with Ctrl+C.

import { supabaseAdmin } from '../src/config/supabaseClient'
import env from '../src/config/env'
import type { DeviceRow, SensorRow } from '../src/types/db'

const DEVICE_IDENTIFIER = 'SIM-DEV-001'
const INTERVAL_MS = Number(process.env.LIVE_SIM_INTERVAL_MS) || 5000

const SENSOR_DEFS: Array<[string, string, string]> = [
  ['ph', 'pre_filtration', 'pH'],
  ['ph', 'post_filtration', 'pH'],
  ['turbidity', 'pre_filtration', 'NTU'],
  ['turbidity', 'post_filtration', 'NTU'],
  ['tds', 'pre_filtration', 'ppm'],
  ['tds', 'post_filtration', 'ppm'],
  ['temperature', 'pre_filtration', '°C'],
  ['temperature', 'post_filtration', '°C'],
  ['flow_rate', 'pre_filtration', 'L/min'],
  ['flow_rate', 'post_filtration', 'L/min'],
]

// Baselines continue where seedTestData.ts's last reading cycle leaves off,
// so a simulator run looks like a continuation of seeded history rather
// than an unrelated jump.
interface ParamState {
  pre: number
  post: number
  step: number
  min: number
  max: number
}

const state: Record<string, ParamState> = {
  ph: { pre: 6.73, post: 7.02, step: 0.02, min: 6.0, max: 8.0 },
  turbidity: { pre: 9.36, post: 0.71, step: 0.15, min: 0.1, max: 15 },
  tds: { pre: 302, post: 180, step: 2, min: 50, max: 400 },
  temperature: { pre: 26.5, post: 26.6, step: 0.1, min: 20, max: 32 },
  flow_rate: { pre: 2.4, post: 2.1, step: 0.1, min: 0, max: 4 },
}

function drift(value: number, spec: ParamState): number {
  const next = value + (Math.random() * 2 - 1) * spec.step
  return Math.min(spec.max, Math.max(spec.min, next))
}

async function ensureDevice(): Promise<DeviceRow> {
  const existing = await supabaseAdmin.from('devices').select('*').eq('device_identifier', DEVICE_IDENTIFIER).maybeSingle()
  if (existing.error) throw new Error(`Load device failed: ${existing.error.message}`)
  if (existing.data) return existing.data

  const created = await supabaseAdmin
    .from('devices')
    .insert({
      device_identifier: DEVICE_IDENTIFIER,
      name: 'Simulated Filtration Unit',
      is_simulated: true,
      controller_name: 'ESP32 DevKit V1',
      connection_state: 'Online',
      wifi_state: 'Connected',
      fail_safe_state: 'Local Control Active',
      last_seen_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (created.error || !created.data) throw new Error(`Create device failed: ${created.error?.message}`)
  return created.data
}

async function ensureSensors(deviceId: string): Promise<SensorRow[]> {
  const existing = await supabaseAdmin.from('sensors').select('*').eq('device_id', deviceId)
  if (existing.error) throw new Error(`Load sensors failed: ${existing.error.message}`)
  if (existing.data.length >= SENSOR_DEFS.length) return existing.data

  const rows = SENSOR_DEFS.map(([category, position, unit]) => ({ device_id: deviceId, category, position, unit }))
  const created = await supabaseAdmin.from('sensors').insert(rows).select('*')
  if (created.error) throw new Error(`Create sensors failed: ${created.error.message}`)
  return created.data
}

interface SkippedReading {
  category: unknown
  position: unknown
  reason: string
}

interface OutgoingReading {
  category: string
  position: 'pre_filtration' | 'post_filtration'
  value: number | null
  status: 'valid' | 'unavailable'
}

function buildReadingBatch(): OutgoingReading[] {
  const readings: OutgoingReading[] = []
  for (const category of Object.keys(state)) {
    const spec = state[category]!
    spec.pre = drift(spec.pre, spec)
    spec.post = drift(spec.post, spec)

    for (const [position, value] of [['pre_filtration', spec.pre], ['post_filtration', spec.post]] as const) {
      // Occasionally simulate a sensor reporting "no reading" rather than a
      // measured value, exercising the value:null / status:"unavailable" path.
      const unavailable = Math.random() < 0.03
      readings.push({
        category,
        position,
        value: unavailable ? null : Math.round(value * 100) / 100,
        status: unavailable ? 'unavailable' : 'valid',
      })
    }
  }
  return readings
}

async function postReadings(deviceId: string): Promise<void> {
  const body = { measuredAt: new Date().toISOString(), readings: buildReadingBatch() }
  const base = `http://localhost:${env.port}/api/v1`

  let response: Response
  try {
    response = await fetch(`${base}/devices/${deviceId}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': env.deviceIngestKey },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error(`✗ POST failed (is the API server running on port ${env.port}?):`, err instanceof Error ? err.message : err)
    return
  }

  const payload = (await response.json().catch(() => null)) as { inserted: number; skipped: SkippedReading[] } | null
  if (!response.ok || !payload) {
    console.error(`✗ ${response.status}`, payload)
    return
  }
  console.log(`✓ ${new Date().toLocaleTimeString()} inserted=${payload.inserted} skipped=${payload.skipped.length}`)
}

async function main(): Promise<void> {
  console.log('Starting live simulator...\n')

  const device = await ensureDevice()
  await ensureSensors(device.id)
  console.log(`✓ Device: ${device.id} (${device.device_identifier})`)
  console.log(`Posting a reading batch every ${INTERVAL_MS}ms to POST /devices/${device.id}/readings. Ctrl+C to stop.\n`)

  await postReadings(device.id)
  const timer = setInterval(() => {
    postReadings(device.id).catch((err) => console.error('✗ Unexpected error:', err))
  }, INTERVAL_MS)

  process.on('SIGINT', () => {
    clearInterval(timer)
    console.log('\nStopped.')
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('\nSimulator failed to start:', err instanceof Error ? err.message : err)
  process.exit(1)
})
