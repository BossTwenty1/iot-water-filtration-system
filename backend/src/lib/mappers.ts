import { displayId, type NumberedRecord } from './displayIds'
// Converts Supabase rows (snake_case, normalized) into the exact JSON shapes
// frontend/src/types/index.ts describes (mirrored in src/types/domain.ts),
// so each mock service in frontend/src/services/*.ts can be pointed at these
// routes with no change to the shape it returns. See docs/API_REFERENCE.md.

import type {
  AlertRow,
  AppSettingsRow,
  CalibrationRecordWithSensor,
  DeviceRow,
  LaboratoryValidationRecordRow,
  MaintenanceRecordWithPerformer,
  MaintenanceReminderRow,
  ProfileRow,
  SensorReadingWithSensor,
  TestRunRow,
} from '../types/db'
import type {
  AppSettings,
  CalibrationParameters,
  CalibrationRecord,
  DeviceStatus,
  LaboratoryValidationRecord,
  LaboratoryValidationResults,
  MaintenanceRecord,
  MaintenanceReminder,
  SensorParameter,
  SensorReading,
  SensorStage,
  SystemAlert,
  TelemetryRecord,
  TestRun,
  User,
} from '../types/domain'

const CATEGORY_TO_PARAMETER: Record<string, SensorParameter> = {
  ph: 'pH',
  turbidity: 'turbidity',
  tds: 'TDS',
  temperature: 'temperature',
  flow_rate: 'flowRate',
}

const PARAMETER_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_TO_PARAMETER).map(([category, parameter]) => [parameter, category])
)

const POSITION_TO_STAGE: Record<string, SensorStage> = { pre_filtration: 'before', post_filtration: 'after' }
const STAGE_TO_POSITION: Record<string, string> = { before: 'pre_filtration', after: 'post_filtration' }

// The confirmed sensor category/position sets (REQUIREMENTS.md) — exported
// so ingestion validation (src/routes/devices.routes.ts) uses the same
// source of truth instead of duplicating the list.
export const VALID_CATEGORIES = Object.keys(CATEGORY_TO_PARAMETER)
export const VALID_POSITIONS = Object.keys(POSITION_TO_STAGE)

export function categoryToParameter(category: string | null | undefined): SensorParameter {
  if (!category) return category as SensorParameter
  return CATEGORY_TO_PARAMETER[category] ?? (category as SensorParameter)
}

export function parameterToCategory(parameter: string): string {
  return PARAMETER_TO_CATEGORY[parameter] ?? parameter
}

export function positionToStage(position: string | null | undefined): SensorStage {
  if (!position) return position as SensorStage
  return POSITION_TO_STAGE[position] ?? (position as SensorStage)
}

export function stageToPosition(stage: string): string {
  return STAGE_TO_POSITION[stage] ?? stage
}

export function toAlert(row: AlertRow): SystemAlert {
  return {
    id: row.id,
    displayId: displayId('Alert', row.display_number),
    timestamp: row.triggered_at,
    severity: (row.severity ?? 'Information') as SystemAlert['severity'],
    source: row.source,
    title: row.title,
    message: row.message,
    testRunDisplayId: displayId('Test', row.test_run?.display_number),
    testRunId: row.test_run_id ?? undefined,
    status: (row.status ?? 'Active') as SystemAlert['status'],
  }
}

// Fields hydrateTestRun (src/lib/testRunHydrator.ts) computes on top of the
// raw test_runs row — not stored columns.
export interface TestRunComputedFields {
  duration: string
  telemetryCount: number
  alertCount: number
  validationStatus: 'Pending' | 'Available'
}

export function toTestRun(row: TestRunRow & TestRunComputedFields): TestRun {
  return {
    id: row.id,
    displayId: displayId('Test', row.display_number),
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    duration: row.duration,
    processedVolume: row.target_volume_liters ?? 0,
    status: (row.status ?? 'In Progress') as TestRun['status'],
    telemetryCount: row.telemetryCount,
    alertCount: row.alertCount,
    validationStatus: row.validationStatus,
    notes: row.notes ?? '',
  }
}

export function toCalibrationRecord(row: CalibrationRecordWithSensor): CalibrationRecord {
  const sensor = row.sensor
  const params = (row.parameters as CalibrationParameters | null) ?? {}
  return {
    id: row.id,
    displayId: displayId('Sensor check', row.display_number),
    date: row.performed_at,
    parameter: categoryToParameter(sensor?.category) as CalibrationRecord['parameter'],
    stage: positionToStage(sensor?.position),
    model: params.model ?? 'Pending Confirmation',
    referenceValue: params.referenceValue ?? null,
    sensorReading: params.sensorReading ?? null,
    unit: sensor?.unit ?? '',
    status: params.status ?? 'Record Available',
    notes: row.notes ?? '',
  }
}

export function toLaboratoryValidationRecord(row: LaboratoryValidationRecordRow): LaboratoryValidationRecord {
  const results = (row.results as LaboratoryValidationResults | null) ?? {}
  return {
    id: row.id,
    displayId: displayId('Lab record', row.display_number),
    date: row.validated_at,
    testRunDisplayId: displayId('Test', row.test_run?.display_number),
    testRunId: row.test_run_id,
    sampleId: row.sample_reference,
    stage: results.stage,
    parameter: results.parameter,
    referenceResult: results.referenceResult,
    sensorReading: results.sensorReading,
    unit: results.unit,
    status: results.referenceResult === undefined && row.percentage_error === null ? 'Pending' : 'Available',
    conclusion: results.conclusion,
    notes: results.notes ?? '',
  }
}

export function toMaintenanceRecord(row: MaintenanceRecordWithPerformer): MaintenanceRecord {
  return {
    id: row.id,
    displayId: displayId('Maintenance', row.display_number),
    date: row.occurred_at,
    component: row.component,
    type: row.type,
    description: row.description,
    status: row.status,
    performedBy: row.performer?.full_name ?? row.performer?.email ?? 'Unknown',
    notes: row.notes ?? '',
  }
}

export function toMaintenanceReminder(row: MaintenanceReminderRow): MaintenanceReminder {
  return {
    id: row.id,
    displayId: displayId('Reminder', row.display_number),
    component: row.component,
    label: row.label,
    dueDate: row.due_date,
    status: row.status,
  }
}

type UserLike = NumberedRecord & Pick<ProfileRow, 'id'> & Partial<Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'status'>>

export function toUser(row: UserLike): User {
  return {
    id: row.id,
    displayId: displayId('User', row.display_number),
    name: row.full_name?.trim() || row.email?.trim() || displayId('User', row.display_number) || 'Unnamed user',
    email: row.email ?? '',
    role: (row.role ?? 'Viewer') as User['role'],
    status: row.status ?? 'Active',
  }
}

export function toDeviceStatus(row: DeviceRow & { latestReadingAt?: string | null }): DeviceStatus {
  return {
    deviceId: row.id,
    displayId: displayId('Device', row.display_number),
    controller: row.controller_name ?? row.name ?? 'Unknown Controller',
    connection: row.connection_state ?? 'Pending Hardware Integration',
    wifiConnection: row.wifi_state ?? 'Not Configured',
    failSafeControl: row.fail_safe_state ?? 'Pending Hardware Integration',
    lastUpdatedAt: row.last_seen_at ?? row.latestReadingAt ?? undefined,
  }
}

export function toAppSettings(row: Partial<AppSettingsRow>): AppSettings {
  return {
    systemName: row.system_name ?? '',
    deviceDisplayName: row.device_display_name ?? '',
    timezone: row.timezone ?? '',
    dateFormat: row.date_format ?? '',
    timeFormat: row.time_format ?? '',
    notifications: (row.notifications as AppSettings['notifications']) ?? {},
  }
}

// Default window for pairing a pre-filtration board's cycle with a
// post-filtration board's cycle when their measuredAt values differ
// (boards not yet slot-aligned). PROVISIONAL — the approved tolerance is TBD
// (docs/TWO_BOARD_SYNC_AND_MERGE.md); override with TELEMETRY_PAIR_TOLERANCE_MS.
export const DEFAULT_PAIR_TOLERANCE_MS = 30_000

export interface TelemetryGroupingOptions {
  // Max |after - before| for a nearest-match pair. 0 = exact matches only.
  pairToleranceMs?: number
}

// One device's reading cycle: every reading sharing device/testRun/measuredAt.
interface ReadingCycle {
  id: string
  deviceId: string
  deviceDisplayId?: string
  installationId: string | null
  testRunId: string | null
  testRunDisplayId?: string
  measuredAt: string
  timeMs: number
  hasBefore: boolean
  hasAfter: boolean
  before: TelemetryRecord['before']
  after: TelemetryRecord['after']
}

function cycleKey(deviceId: string, testRunId: string | null, measuredAt: string): string {
  return `${deviceId}|${testRunId ?? ''}|${measuredAt}`
}

function buildCycles(rows: SensorReadingWithSensor[]): ReadingCycle[] {
  const cycles = new Map<string, ReadingCycle>()
  for (const row of rows) {
    const key = cycleKey(row.device_id, row.test_run_id, row.measured_at)
    let cycle = cycles.get(key)
    if (!cycle) {
      cycle = {
        id: key,
        deviceId: row.device_id,
        deviceDisplayId: displayId('Device', row.device?.display_number),
        installationId: row.device?.installation_id ?? null,
        testRunId: row.test_run_id,
        testRunDisplayId: displayId('Test', row.test_run?.display_number),
        measuredAt: row.measured_at,
        timeMs: Date.parse(row.measured_at),
        hasBefore: false,
        hasAfter: false,
        before: {},
        after: {},
      }
      cycles.set(key, cycle)
    }
    const stage = positionToStage(row.sensor?.position)
    // A side counts as reported even when its value is null (fault/invalid),
    // so a board's all-null cycle still occupies its slot instead of pairing
    // with an unrelated cycle.
    if (stage === 'before') cycle.hasBefore = true
    else if (stage === 'after') cycle.hasAfter = true
    if (row.value === null || row.value === undefined) continue
    const parameter = categoryToParameter(row.sensor?.category)
    if (stage === 'before') cycle.before[parameter] = row.value
    else if (stage === 'after') cycle.after[parameter] = row.value
  }
  return [...cycles.values()]
}

function singleRecord(cycle: ReadingCycle, pairing: 'single-device' | 'unpaired'): TelemetryRecord {
  return {
    id: cycle.id,
    timestamp: cycle.measuredAt,
    testRunId: cycle.testRunId,
    testRunDisplayId: cycle.testRunDisplayId,
    deviceId: cycle.deviceId,
    deviceDisplayId: cycle.deviceDisplayId,
    before: cycle.before,
    after: cycle.after,
    pairing,
    installationId: cycle.installationId,
    beforeDeviceId: cycle.hasBefore ? cycle.deviceId : null,
    afterDeviceId: cycle.hasAfter ? cycle.deviceId : null,
    beforeDeviceDisplayId: cycle.hasBefore ? cycle.deviceDisplayId : undefined,
    afterDeviceDisplayId: cycle.hasAfter ? cycle.deviceDisplayId : undefined,
    beforeMeasuredAt: cycle.hasBefore ? cycle.measuredAt : null,
    afterMeasuredAt: cycle.hasAfter ? cycle.measuredAt : null,
    pairGapSeconds: cycle.hasBefore && cycle.hasAfter ? 0 : null,
  }
}

function pairedRecord(before: ReadingCycle, after: ReadingCycle): TelemetryRecord {
  const gapSeconds = (after.timeMs - before.timeMs) / 1000
  const deviceDisplayId = before.deviceDisplayId && after.deviceDisplayId
    ? `${before.deviceDisplayId} + ${after.deviceDisplayId}`
    : before.deviceDisplayId ?? after.deviceDisplayId
  return {
    // `~` joins the two cycle ids so GET /telemetry/:id can reload both.
    id: `${before.id}~${after.id}`,
    // The pre-filtration cycle is the row's reference time.
    timestamp: before.measuredAt,
    testRunId: before.testRunId,
    testRunDisplayId: before.testRunDisplayId,
    deviceId: before.deviceId,
    deviceDisplayId,
    before: before.before,
    after: after.after,
    pairing: gapSeconds === 0 ? 'exact' : 'nearest',
    installationId: before.installationId,
    beforeDeviceId: before.deviceId,
    afterDeviceId: after.deviceId,
    beforeDeviceDisplayId: before.deviceDisplayId,
    afterDeviceDisplayId: after.deviceDisplayId,
    beforeMeasuredAt: before.measuredAt,
    afterMeasuredAt: after.measuredAt,
    pairGapSeconds: gapSeconds,
  }
}

// Pivots a flat array of sensor_readings (joined with their sensor's
// category/position and device) into TelemetryRecord-shaped { before, after }
// rows, newest first.
//
// 1. Readings are grouped into per-device cycles by device/testRun/measuredAt
//    (one board's upload shares one measuredAt — see docs/API_REFERENCE.md
//    "Telemetry grouping").
// 2. Cycles from boards that share an installation_id and report only one
//    stage are paired: a pre cycle with a post cycle of the same installation
//    and test run, exact measuredAt first, then the nearest within
//    pairToleranceMs. Each cycle is used at most once and no value is ever
//    carried forward; a cycle without a partner stays a half row ("unpaired").
// 3. Everything else (single-device cycles, devices with no installation) is
//    returned exactly as before.
export function groupReadingsIntoTelemetry(rows: SensorReadingWithSensor[], options: TelemetryGroupingOptions = {}): TelemetryRecord[] {
  const toleranceMs = Math.max(0, options.pairToleranceMs ?? DEFAULT_PAIR_TOLERANCE_MS)
  const records: TelemetryRecord[] = []
  const buckets = new Map<string, { befores: ReadingCycle[]; afters: ReadingCycle[] }>()

  for (const cycle of buildCycles(rows)) {
    const oneSided = cycle.hasBefore !== cycle.hasAfter
    if (!cycle.installationId || !oneSided || Number.isNaN(cycle.timeMs)) {
      records.push(singleRecord(cycle, 'single-device'))
      continue
    }
    const bucketKey = `${cycle.installationId}|${cycle.testRunId ?? ''}`
    let bucket = buckets.get(bucketKey)
    if (!bucket) buckets.set(bucketKey, (bucket = { befores: [], afters: [] }))
    ;(cycle.hasBefore ? bucket.befores : bucket.afters).push(cycle)
  }

  for (const { befores, afters } of buckets.values()) {
    // Greedy by smallest gap: exact matches (gap 0) always win, and a cycle
    // is never taken from a closer partner. Ties go to the newer cycle.
    const candidates: Array<{ before: ReadingCycle; after: ReadingCycle; gap: number }> = []
    for (const before of befores) {
      for (const after of afters) {
        if (after.deviceId === before.deviceId) continue
        const gap = Math.abs(after.timeMs - before.timeMs)
        if (gap <= toleranceMs) candidates.push({ before, after, gap })
      }
    }
    candidates.sort((a, b) => a.gap - b.gap || b.before.timeMs - a.before.timeMs)

    const used = new Set<ReadingCycle>()
    for (const { before, after } of candidates) {
      if (used.has(before) || used.has(after)) continue
      used.add(before)
      used.add(after)
      records.push(pairedRecord(before, after))
    }
    for (const cycle of [...befores, ...afters]) {
      if (!used.has(cycle)) records.push(singleRecord(cycle, 'unpaired'))
    }
  }

  return records.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
}

export function toSensorReadings(rows: SensorReadingWithSensor[]): SensorReading[] {
  return rows
    .filter((row) => row.value !== null && row.value !== undefined)
    .map((row) => ({
      parameter: categoryToParameter(row.sensor?.category),
      label: row.sensor?.category ?? '',
      value: row.value as number,
      unit: row.sensor?.unit ?? '',
      stage: positionToStage(row.sensor?.position),
    }))
}
