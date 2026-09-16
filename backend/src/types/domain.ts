// Mirrors frontend/src/types/index.ts on feature/frontend-foundation
// exactly. Every route response is typed against one of these, so a
// TypeScript mismatch here is a compile-time signal that a response no
// longer matches what the frontend's mock services (and eventually its real
// API client) expect. See docs/API_REFERENCE.md.

export type SensorStage = 'before' | 'after'

export type SensorParameter = 'pH' | 'turbidity' | 'TDS' | 'temperature' | 'flowRate' | 'totalVolume'

export type DeviceConnectionState = 'Online' | 'Offline' | 'Pending Hardware Integration'
export type AlertSeverity = 'Information' | 'Warning' | 'Critical'
export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved'
export type RecordStatus = 'Pending' | 'Available'
export type UserRole = 'Administrator' | 'Researcher' | 'Viewer'

export interface SensorReading {
  parameter: SensorParameter
  label: string
  value: number
  unit: string
  stage: SensorStage
  model?: string
}

export interface TelemetryRecord {
  id: string
  timestamp: string
  testRunId: string | null
  deviceId: string
  before: Partial<Record<SensorParameter, number>>
  after: Partial<Record<SensorParameter, number>>
}

export interface TestRun {
  id: string
  startedAt: string
  endedAt?: string
  duration: string
  processedVolume: number
  status: 'In Progress' | 'Completed' | 'Cancelled'
  telemetryCount: number
  alertCount: number
  validationStatus: RecordStatus
  notes: string
}

export interface SystemAlert {
  id: string
  timestamp: string
  severity: AlertSeverity
  source: string | null
  title: string | null
  message: string | null
  testRunId?: string
  status: AlertStatus
}

export interface CalibrationRecord {
  id: string
  date: string
  parameter: Exclude<SensorParameter, 'totalVolume'>
  stage: SensorStage
  model: string
  referenceValue: number | null
  sensorReading: number | null
  unit: string
  status: 'Record Available' | 'Review Needed'
  notes: string
}

export interface LaboratoryValidationRecord {
  id: string
  date: string
  testRunId: string | null
  sampleId: string | null
  stage?: SensorStage
  parameter?: Exclude<SensorParameter, 'flowRate' | 'totalVolume'>
  referenceResult?: number
  sensorReading?: number
  unit?: string
  status: RecordStatus
  conclusion?: string
  notes: string
}

export interface MaintenanceRecord {
  id: string
  date: string
  component: string
  type: string | null
  description: string | null
  status: string | null
  performedBy: string
  notes: string
}

export interface MaintenanceReminder {
  id: string
  component: string
  label: string
  dueDate: string | null
  status: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: string
}

export type UserRecord = User

export interface DeviceStatus {
  deviceId: string
  controller: string
  connection: string
  wifiConnection: string
  failSafeControl: string
  lastUpdatedAt?: string
}

export interface NotificationPreferences {
  offline: boolean
  sensor: boolean
  noFlow: boolean
  waterQuality: boolean
  pump: boolean
  uvc: boolean
  maintenance: boolean
}

export interface AppSettings {
  systemName: string
  deviceDisplayName: string
  timezone: string
  dateFormat: string
  timeFormat: string
  notifications: Partial<NotificationPreferences>
}

export interface TelemetryChartPoint {
  time: string
  before?: number
  after?: number
}

export interface CreateTestRunInput {
  sampleInformation?: string
  notes?: string
  deviceId?: string
}

export interface CreateCalibrationRecordInput {
  parameter: CalibrationRecord['parameter']
  stage: SensorStage
  referenceValue: number
  sensorReading: number
  deviceId?: string
}

export interface CreateLaboratoryValidationRecordInput {
  testRunId: string
  sampleId: string
  referenceResult?: number
  stage?: SensorStage
  parameter?: LaboratoryValidationRecord['parameter']
  sensorReading?: number
  unit?: string
  conclusion?: string
  notes?: string
}

export interface CreateMaintenanceRecordInput {
  component: string
  notes?: string
  type?: string
  description?: string
}

// The jsonb payload shape this backend chooses to store inside
// calibration_records.parameters — the column itself is intentionally
// shapeless (docs/PENDING_DECISIONS.md §12), this is just this API's own
// convention for what it puts there.
export interface CalibrationParameters {
  model?: string
  referenceValue?: number
  sensorReading?: number
  status?: CalibrationRecord['status']
}

// Same idea for laboratory_validation_records.results.
export interface LaboratoryValidationResults {
  stage?: SensorStage
  parameter?: LaboratoryValidationRecord['parameter']
  referenceResult?: number
  sensorReading?: number
  unit?: string
  conclusion?: string
  notes?: string
}

// Auth response envelope — new domain, not in the frontend types yet (see
// docs/API_REFERENCE.md "Authentication").
export interface AuthSession {
  token: string
  refreshToken: string
  expiresIn: number
  user: User
}
