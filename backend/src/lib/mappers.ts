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
    timestamp: row.triggered_at,
    severity: (row.severity ?? 'Information') as SystemAlert['severity'],
    source: row.source,
    title: row.title,
    message: row.message,
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
    date: row.validated_at,
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
    component: row.component,
    label: row.label,
    dueDate: row.due_date,
    status: row.status,
  }
}

type UserLike = Pick<ProfileRow, 'id'> & Partial<Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'status'>>

export function toUser(row: UserLike): User {
  return {
    id: row.id,
    name: row.full_name ?? row.email ?? row.id,
    email: row.email ?? '',
    role: (row.role ?? 'Viewer') as User['role'],
    status: row.status ?? 'Active',
  }
}

export function toDeviceStatus(row: DeviceRow & { latestReadingAt?: string | null }): DeviceStatus {
  return {
    deviceId: row.id,
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

// Pivots a flat array of sensor_readings (joined with their sensor's
// category/position) into TelemetryRecord-shaped { before, after } maps,
// grouped by measured_at. Assumes one reading cycle shares an identical
// measured_at across all sensors in the batch (documented assumption — see
// docs/API_REFERENCE.md "Telemetry grouping").
export function groupReadingsIntoTelemetry(rows: SensorReadingWithSensor[]): TelemetryRecord[] {
  const groups = new Map<string, TelemetryRecord>()
  for (const row of rows) {
    const key = `${row.device_id}|${row.test_run_id ?? ''}|${row.measured_at}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        timestamp: row.measured_at,
        testRunId: row.test_run_id,
        deviceId: row.device_id,
        before: {},
        after: {},
      })
    }
    const group = groups.get(key) as TelemetryRecord
    const parameter = categoryToParameter(row.sensor?.category)
    const stage = positionToStage(row.sensor?.position)
    if (row.value === null || row.value === undefined) continue
    if (stage === 'before') group.before[parameter] = row.value
    else if (stage === 'after') group.after[parameter] = row.value
  }
  return [...groups.values()].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
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
