// Simulates the CURRENT ESP32 firmware (firmware/esp32/, telemetry.h + FF.ino)
// as two independent boards, the way the real installation runs:
//
//   ESP32 DevKit V1 -> position "pre_filtration"   (its own device UUID)
//   ESP32-S3        -> position "post_filtration"  (its own device UUID)
//
// Each simulated board mirrors the firmware's behaviour:
//   - sensor loop every 1 s (SENSOR_INTERVAL_MS) refreshes a "latest snapshot"
//   - a separate telemetry task checks every 1 s and, once per
//     kTelemetryIntervalMs (60 s), uploads the snapshot IF Wi-Fi is up, the
//     clock is synced, and the snapshot is <= 10 s old (kTelemetryMaxAgeMs)
//   - first upload happens one full interval after the task starts
//   - measuredAt = now - snapshot age, whole seconds, "YYYY-MM-DDTHH:MM:SSZ"
//   - payload: { measuredAt, readings: [ph, tds, turbidity, temperature, flow_rate] }
//     all with this board's single position, decimals 2/1/1/2/2, null when no value
//   - status: "fault" (sensor failed POST) | "uncalibrated" | "invalid" | "valid"
//   - POST /devices/<uuid>/readings with X-Device-Key, no retry, no offline queue:
//     a failed upload is simply lost, exactly like the firmware
//   - the boards never talk to each other; they only share wall-clock time
//
// ESP32_SIM_ALIGNED=1 simulates the proposed firmware Fix 1
// (docs/TWO_BOARD_SYNC_AND_MERGE.md): both boards upload on the same UTC slot
// boundary and send that slot as measuredAt, so the backend can merge them
// exactly. Without it, boards keep the current boot-relative schedule.
//
// Both simulated boards are put in one installation (devices.installation_id)
// so GET /telemetry merges their before/after cycles.
//
// Optional disturbances (also like the field): Wi-Fi drops and the operator
// opening the menu (sensor loop pauses -> snapshot goes stale -> upload skipped).
//
// ALL VALUES ARE SYNTHETIC DUMMY DATA. They are not real measurements, not
// calibrated, and say nothing about whether water is safe to drink.
//
// Usage (from backend/, with local Supabase + `npm run dev` running):
//   npm run simulate:esp32
//   ESP32_SIM_INTERVAL_MS=10000 npm run simulate:esp32         # faster uploads
//   ESP32_SIM_FAULTS=pre:tds,pre:turbidity npm run simulate:esp32
//   ESP32_SIM_UNCALIBRATED=post:ph ESP32_SIM_EVENTS=0 npm run simulate:esp32
//   ESP32_SIM_BOARDS=pre npm run simulate:esp32                # only one board
//   ESP32_SIM_ALIGNED=1 npm run simulate:esp32                 # proposed slot-aligned firmware
// Stop with Ctrl+C.

import { supabaseAdmin } from '../src/config/supabaseClient'
import env from '../src/config/env'

// ---------------- firmware constants (net_config.h / FF.ino) ----------------
const SENSOR_INTERVAL_MS = 1000
const TASK_TICK_MS = 1000
const TELEMETRY_INTERVAL_MS = Number(process.env.ESP32_SIM_INTERVAL_MS) || 60_000
const TELEMETRY_MAX_AGE_MS = 10_000
const HTTP_TIMEOUT_MS = 10_000 // kHttpConnectTimeoutMs + kHttpResponseTimeoutMs
const API_BASE = (process.env.ESP32_SIM_API_BASE || `http://localhost:${env.port}/api/v1`).replace(/\/+$/, '')
const EVENTS_ENABLED = process.env.ESP32_SIM_EVENTS !== '0'
const ALIGNED = process.env.ESP32_SIM_ALIGNED === '1'
// Fixed, obviously synthetic installation id shared by the two simulated boards.
const SIM_INSTALLATION_ID = '00000000-0000-4000-8000-00000000510a'

type Position = 'pre_filtration' | 'post_filtration'
type Category = 'ph' | 'tds' | 'turbidity' | 'temperature' | 'flow_rate'

// telemetry.h kTelemetrySensors / kApiCategory, in firmware order
const SENSORS: Array<{ category: Category; unit: string; decimals: number; needsCalibration: boolean }> = [
  { category: 'ph', unit: 'pH', decimals: 2, needsCalibration: true },
  { category: 'tds', unit: 'ppm', decimals: 1, needsCalibration: false },
  { category: 'turbidity', unit: 'NTU', decimals: 1, needsCalibration: true },
  { category: 'temperature', unit: '°C', decimals: 2, needsCalibration: false },
  { category: 'flow_rate', unit: 'L/min', decimals: 2, needsCalibration: false },
]

// Dummy drift ranges. Synthetic only; NOT water-quality thresholds.
const DUMMY_RANGES: Record<Position, Record<Category, { start: number; step: number; min: number; max: number }>> = {
  pre_filtration: {
    ph: { start: 6.8, step: 0.02, min: 6.0, max: 8.0 },
    tds: { start: 300, step: 2, min: 50, max: 400 },
    turbidity: { start: 9.0, step: 0.15, min: 0.1, max: 15 },
    temperature: { start: 26.5, step: 0.05, min: 20, max: 32 },
    flow_rate: { start: 2.4, step: 0.1, min: 0, max: 4 },
  },
  post_filtration: {
    ph: { start: 7.0, step: 0.02, min: 6.0, max: 8.0 },
    tds: { start: 180, step: 2, min: 50, max: 400 },
    turbidity: { start: 0.8, step: 0.05, min: 0.1, max: 15 },
    temperature: { start: 26.6, step: 0.05, min: 20, max: 32 },
    flow_rate: { start: 2.1, step: 0.1, min: 0, max: 4 },
  },
}

interface BoardSpec {
  key: 'pre' | 'post'
  identifier: string
  name: string
  controller: string
  position: Position
}

const BOARD_SPECS: BoardSpec[] = [
  { key: 'pre', identifier: 'SIM-ESP32-PRE-001', name: 'Simulated Board - Pre-filtration', controller: 'ESP32 DevKit V1', position: 'pre_filtration' },
  { key: 'post', identifier: 'SIM-ESP32S3-POST-001', name: 'Simulated Board - Post-filtration', controller: 'ESP32-S3', position: 'post_filtration' },
]

// "pre:tds,post:ph" -> Set of "pre:tds", "post:ph"
function parseFlags(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))
}
const FAULTS = parseFlags(process.env.ESP32_SIM_FAULTS)
const UNCALIBRATED = parseFlags(process.env.ESP32_SIM_UNCALIBRATED)

// ---------------- one simulated board ----------------

class SimulatedBoard {
  private values = new Map<Category, number>()
  private snapshot: { values: Map<Category, number>; updatedMs: number } | null = null
  private lastAttemptMs = 0
  private lastSlotS = 0
  private wifiDownUntil = 0
  private menuOpenUntil = 0
  private timeSynced = false
  private timers: NodeJS.Timeout[] = []
  private busy = false

  constructor(private spec: BoardSpec, private deviceId: string) {
    for (const s of SENSORS) this.values.set(s.category, DUMMY_RANGES[spec.position][s.category].start)
  }

  private log(msg: string): void {
    const t = new Date().toISOString().slice(11, 19)
    console.log(`${t} [${this.spec.key.padEnd(4)} ${this.spec.controller.padEnd(15)}] ${msg}`)
  }

  start(): void {
    this.lastAttemptMs = Date.now() // first upload one interval after the task starts
    // SNTP needs a moment after Wi-Fi comes up; uploads wait for it (time_sync.cpp).
    setTimeout(() => { this.timeSynced = true; this.log('[time] synced') }, 1000 + Math.random() * 3000)
    this.timers.push(setInterval(() => this.sensorLoop(), SENSOR_INTERVAL_MS))
    this.timers.push(setInterval(() => void this.telemetryTask(), TASK_TICK_MS))
    this.log(`booted, device ${this.deviceId}, uploads every ${TELEMETRY_INTERVAL_MS / 1000}s`)
  }

  stop(): void { this.timers.forEach(clearInterval) }

  private sensorFailedPost(c: Category): boolean { return FAULTS.has(`${this.spec.key}:${c}`) }
  private calibrated(c: Category): boolean { return !UNCALIBRATED.has(`${this.spec.key}:${c}`) }

  // FF.ino loop(): read sensors on a timer, then telemetryUpdate(...). Paused while the menu is open.
  private sensorLoop(): void {
    const now = Date.now()
    if (now < this.menuOpenUntil) return

    const reading = new Map<Category, number>()
    for (const s of SENSORS) {
      const r = DUMMY_RANGES[this.spec.position][s.category]
      const next = Math.min(r.max, Math.max(r.min, this.values.get(s.category)! + (Math.random() * 2 - 1) * r.step))
      this.values.set(s.category, next)
      // A failed or uncalibrated sensor produces NaN, which the firmware sends as null.
      const usable = !this.sensorFailedPost(s.category) && (!s.needsCalibration || this.calibrated(s.category))
      reading.set(s.category, usable ? next : NaN)
    }
    this.snapshot = { values: reading, updatedMs: now }
  }

  private maybeDisturb(now: number): void {
    if (!EVENTS_ENABLED) return
    const wifiDown = now < this.wifiDownUntil
    if (this.wifiDownUntil && !wifiDown) {
      this.wifiDownUntil = 0
      this.log('[wifi] reconnected')
    }
    if (!wifiDown && Math.random() < 0.002) {
      const ms = 30_000 + Math.random() * 90_000
      this.wifiDownUntil = now + ms
      this.log(`[wifi] connection lost (simulated, ~${Math.round(ms / 1000)}s)`)
    }
    if (now >= this.menuOpenUntil && Math.random() < 0.001) {
      const ms = 20_000 + Math.random() * 70_000
      this.menuOpenUntil = now + ms
      this.log(`[menu] operator opened the menu (simulated, ~${Math.round(ms / 1000)}s): sensor loop paused`)
    }
  }

  private status(c: Category, value: number): string {
    if (this.sensorFailedPost(c)) return 'fault'
    if (!Number.isFinite(value)) {
      const needsCal = SENSORS.find((s) => s.category === c)!.needsCalibration
      return needsCal && !this.calibrated(c) ? 'uncalibrated' : 'invalid'
    }
    return 'valid'
  }

  private buildPayload(snap: { values: Map<Category, number> }, measuredAt: Date): string {
    // Matches telemetryBuildPayload(): fixed key order, fixed decimals, null for NaN.
    const iso = measuredAt.toISOString().replace(/\.\d{3}Z$/, 'Z')
    const readings = SENSORS.map((s) => {
      const v = snap.values.get(s.category)!
      const value = Number.isFinite(v) ? v.toFixed(s.decimals) : 'null'
      return `{"category":"${s.category}","position":"${this.spec.position}","value":${value},"status":"${this.status(s.category, v)}"}`
    })
    return `{"measuredAt":"${iso}","readings":[${readings.join(',')}]}`
  }

  // telemetry.h telemetryTask(): one pass of the 1 s loop.
  private async telemetryTask(): Promise<void> {
    if (this.busy) return // a real HTTPS request blocks the task
    const now = Date.now()
    this.maybeDisturb(now)

    const wifiConnected = now >= this.wifiDownUntil
    if (!wifiConnected || !this.timeSynced) return

    // Current firmware: interval counted from this board's task start.
    // Aligned (proposed Fix 1): once per UTC slot, shared by both boards.
    const intervalS = Math.max(1, Math.round(TELEMETRY_INTERVAL_MS / 1000))
    const nowS = Math.floor(now / 1000)
    const slotS = nowS - (nowS % intervalS)
    if (ALIGNED ? slotS === this.lastSlotS : now - this.lastAttemptMs < TELEMETRY_INTERVAL_MS) return
    // Aligned: only send near the slot boundary, so measuredAt = slot start is
    // honest. A board that boots or reconnects mid-slot waits for the next one
    // instead of stamping late readings with an earlier time.
    if (ALIGNED && now - slotS * 1000 > TELEMETRY_MAX_AGE_MS) return

    const snap = this.snapshot
    if (!snap) return
    const ageMs = now - snap.updatedMs
    if (ageMs > TELEMETRY_MAX_AGE_MS) return // stale (menu open): skipped, interval not used up

    this.lastAttemptMs = now
    this.lastSlotS = slotS
    const measuredAt = ALIGNED
      ? new Date(slotS * 1000)
      : new Date(nowS * 1000 - Math.floor(ageMs / 1000) * 1000)
    const body = this.buildPayload(snap, measuredAt)

    this.busy = true
    try {
      const res = await fetch(`${API_BASE}/devices/${this.deviceId}/readings`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Device-Key': env.deviceIngestKey },
        body,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      const text = await res.text()
      if (res.ok) {
        let note = ''
        try {
          const json = JSON.parse(text) as { inserted?: number; skipped?: unknown[] }
          note = ` inserted=${json.inserted} skipped=${json.skipped?.length ?? 0}`
        } catch { /* the firmware ignores the reply body too */ }
        this.log(`[telemetry] sent (${body.length} bytes) HTTP ${res.status}${note}`)
      } else {
        this.log(`[telemetry] upload failed: http-error (code ${res.status}) server says: ${text.slice(0, 200)}`)
      }
    } catch (err) {
      this.log(`[telemetry] upload failed: transport-error (${err instanceof Error ? err.message : err}) - data dropped, no retry`)
    } finally {
      this.busy = false
    }
  }
}

// ---------------- backend registration (dummy devices + sensors) ----------------

async function ensureBoard(spec: BoardSpec): Promise<string> {
  const existing = await supabaseAdmin.from('devices').select('id').eq('device_identifier', spec.identifier).maybeSingle()
  if (existing.error) throw new Error(`Load device failed: ${existing.error.message}`)
  let deviceId = existing.data?.id
  if (!deviceId) {
    const created = await supabaseAdmin
      .from('devices')
      .insert({
        device_identifier: spec.identifier,
        name: spec.name,
        is_simulated: true,
        controller_name: spec.controller,
        connection_state: 'Online',
        wifi_state: 'Connected',
        fail_safe_state: 'Local Control Active',
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (created.error || !created.data) throw new Error(`Create device failed: ${created.error?.message}`)
    deviceId = created.data.id
  }

  // Both simulated boards belong to one filtration unit.
  const paired = await supabaseAdmin.from('devices').update({ installation_id: SIM_INSTALLATION_ID }).eq('id', deviceId)
  if (paired.error) console.warn(`! could not set installation_id (migration applied?): ${paired.error.message}`)

  // Register only this board's position (one board = one filtration stage).
  const sensors = await supabaseAdmin.from('sensors').select('category, position').eq('device_id', deviceId)
  if (sensors.error) throw new Error(`Load sensors failed: ${sensors.error.message}`)
  const have = new Set(sensors.data.map((s) => `${s.category}|${s.position}`))
  const missing = SENSORS.filter((s) => !have.has(`${s.category}|${spec.position}`))
    .map((s) => ({ device_id: deviceId!, category: s.category, position: spec.position, unit: s.unit }))
  if (missing.length) {
    const ins = await supabaseAdmin.from('sensors').insert(missing)
    if (ins.error) throw new Error(`Create sensors failed: ${ins.error.message}`)
  }
  return deviceId
}

async function main(): Promise<void> {
  const wanted = parseFlags(process.env.ESP32_SIM_BOARDS || 'pre,post')
  const specs = BOARD_SPECS.filter((b) => wanted.has(b.key))
  if (!specs.length) throw new Error('ESP32_SIM_BOARDS must contain "pre", "post" or both.')

  console.log(`ESP32 two-board simulator (synthetic dummy data) -> ${API_BASE}`)
  console.log(`schedule ${ALIGNED ? 'UTC-slot aligned (proposed Fix 1)' : 'boot-relative (current firmware)'}, events ${EVENTS_ENABLED ? 'on' : 'off'}, faults [${[...FAULTS].join(', ') || 'none'}], uncalibrated [${[...UNCALIBRATED].join(', ') || 'none'}]\n`)

  const boards: SimulatedBoard[] = []
  for (const spec of specs) {
    const deviceId = await ensureBoard(spec)
    const board = new SimulatedBoard(spec, deviceId)
    boards.push(board)
    // Boards are powered up independently, so their upload schedules are not aligned.
    setTimeout(() => board.start(), Math.random() * 5000)
  }

  process.on('SIGINT', () => {
    boards.forEach((b) => b.stop())
    console.log('\nStopped.')
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('\nSimulator failed to start:', err instanceof Error ? err.message : err)
  process.exit(1)
})
