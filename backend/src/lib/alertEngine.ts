// Generates `alerts` rows from incoming sensor readings — the piece
// docs/tracker/todo.md flagged as missing: "storage and the acknowledge/
// resolve/stream API exist, but nothing currently evaluates sensor readings
// ... and inserts an alerts row." Called from
// src/routes/devices.routes.ts right after a reading batch is inserted.
//
// Scope is deliberately limited to what's actually decided: sensor-quality
// alerts (threshold breach, sensor fault) only. Pump/UV-C/filter alert
// categories are NOT generated here — there is no pump/UV-C telemetry in
// this schema at all yet, and PENDING_DECISIONS.md leaves control authority
// (P0-05) open. Device-offline alerts are handled separately by
// src/lib/deviceWatchdog.ts (no per-reading signal for that).
//
// Threshold VALUES are never hardcoded here — they're read from the
// `thresholds` table (src/routes/settings.routes.ts), which is empty by
// default. This function does nothing until someone configures a threshold
// via PUT /thresholds, matching the existing "kept unconfigured until
// approved" behavior (PENDING_DECISIONS.md "approved thresholds").
import { supabaseAdmin } from '../config/supabaseClient'
import { categoryToParameter, positionToStage } from './mappers'
import type { ThresholdRow } from '../types/db'

export interface EvaluableReading {
  sensorReadingId: string
  category: string
  position: string
  value: number | null
  readingStatus: string | null
}

interface ThresholdConfig {
  min?: number
  max?: number
  severity?: string
}

// Reading-status values that mean "no usable measurement" — mirrors the
// value:null / status:"unavailable" convention documented in
// docs/API_REFERENCE.md's POST /devices/:id/readings section. `reading_status`
// is free text (PENDING_DECISIONS.md — per-sensor validity rule not
// decided), so this checks a small set of synonyms rather than one exact
// string.
const UNAVAILABLE_STATUSES = new Set(['unavailable', 'invalid', 'error', 'fault'])

// Display labels only — matches the client-confirmed alert-type wording
// (tracker "Client Requirements": "abnormal pH, high turbidity/TDS, temp
// warning"). No business/threshold value is decided here.
const SENSOR_LABEL: Record<string, string> = {
  ph: 'pH',
  turbidity: 'Turbidity',
  tds: 'TDS',
  temperature: 'Temperature',
  flow_rate: 'Flow',
}

const BREACH_TITLE: Record<string, string> = {
  ph: 'Abnormal pH',
  turbidity: 'High Turbidity',
  tds: 'High TDS',
  temperature: 'Temperature Warning',
  flow_rate: 'Abnormal Flow',
}

function stageLabel(position: string): string {
  return positionToStage(position) === 'before' ? 'Pre-Filtration' : 'Post-Filtration'
}

function sourceFor(category: string, position: string): string {
  return `${stageLabel(position)} ${SENSOR_LABEL[category] ?? category} Sensor`
}

// Auto-resolves an Active alert for (deviceId, source) if one exists — used
// by src/lib/deviceWatchdog.ts to close the loop when a device that was
// marked Offline sends a reading again. `changed_by: null` marks this as a
// system action in the same alert_state_changes audit trail the manual
// acknowledge/resolve routes in src/routes/alerts.routes.ts write to.
export async function resolveActiveAlertBySource(deviceId: string, source: string): Promise<void> {
  const { data: alert } = await supabaseAdmin
    .from('alerts')
    .select('id, status')
    .eq('device_id', deviceId)
    .eq('source', source)
    .eq('status', 'Active')
    .maybeSingle()
  if (!alert) return

  await supabaseAdmin.from('alerts').update({ status: 'Resolved' }).eq('id', alert.id)
  await supabaseAdmin.from('alert_state_changes').insert({ alert_id: alert.id, from_status: alert.status, to_status: 'Resolved', changed_by: null })
}

async function hasActiveAlert(deviceId: string, source: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('alerts')
    .select('id')
    .eq('device_id', deviceId)
    .eq('source', source)
    .eq('status', 'Active')
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

export interface RaiseAlertInput {
  deviceId: string
  testRunId: string | null
  sensorReadingId: string | null
  category: string
  source: string
  title: string
  message: string
  severity: string
}

// Exported for src/lib/deviceWatchdog.ts, which raises a "Device Offline"
// alert outside the per-reading evaluation loop above.
export async function raiseAlertIfNotActive(input: RaiseAlertInput): Promise<void> {
  if (await hasActiveAlert(input.deviceId, input.source)) return
  await supabaseAdmin.from('alerts').insert({
    device_id: input.deviceId,
    test_run_id: input.testRunId,
    sensor_reading_id: input.sensorReadingId,
    category: input.category,
    source: input.source,
    title: input.title,
    message: input.message,
    severity: input.severity,
    status: 'Active',
  })
}

function loadThresholdMap(rows: ThresholdRow[]): Map<string, ThresholdConfig> {
  const map = new Map<string, ThresholdConfig>()
  for (const row of rows) {
    map.set(`${row.parameter}|${row.stage}`, (row.config as ThresholdConfig) ?? {})
  }
  return map
}

export async function evaluateReadingsForAlerts(
  deviceId: string,
  testRunId: string | null,
  readings: EvaluableReading[]
): Promise<void> {
  if (readings.length === 0) return

  const { data: thresholdRows } = await supabaseAdmin.from('thresholds').select('*')
  const thresholds = loadThresholdMap(thresholdRows ?? [])

  for (const reading of readings) {
    const source = sourceFor(reading.category, reading.position)

    if (reading.readingStatus && UNAVAILABLE_STATUSES.has(reading.readingStatus.toLowerCase())) {
      await raiseAlertIfNotActive({
        deviceId,
        testRunId,
        sensorReadingId: reading.sensorReadingId,
        category: 'Sensor Fault',
        source,
        title: 'Sensor Connection Warning',
        message: `${source} reading temporarily unavailable. Waiting for the next valid reading.`,
        severity: 'Warning',
      })
      continue
    }

    if (reading.value === null) continue

    const parameter = categoryToParameter(reading.category)
    const stage = positionToStage(reading.position)
    const config = thresholds.get(`${parameter}|${stage}`) ?? thresholds.get(`${parameter}|`)
    if (!config) continue

    const belowMin = typeof config.min === 'number' && reading.value < config.min
    const aboveMax = typeof config.max === 'number' && reading.value > config.max
    if (!belowMin && !aboveMax) continue

    const bound = belowMin ? `below the configured minimum of ${config.min}` : `above the configured maximum of ${config.max}`
    await raiseAlertIfNotActive({
      deviceId,
      testRunId,
      sensorReadingId: reading.sensorReadingId,
      category: 'Water Quality',
      source,
      title: BREACH_TITLE[reading.category] ?? `Abnormal ${SENSOR_LABEL[reading.category] ?? reading.category}`,
      message: `${source} reading of ${reading.value} is ${bound}.`,
      severity: config.severity ?? 'Warning',
    })
  }
}
