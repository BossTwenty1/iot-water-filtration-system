export type SensorStage = 'before' | 'after'

export type SensorParameter =
  | 'pH'
  | 'turbidity'
  | 'TDS'
  | 'temperature'
  | 'flowRate'
  | 'totalVolume'

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
  testRunId: string
  deviceId: string
  before: Record<SensorParameter, number>
  after: Record<SensorParameter, number>
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
  source: string
  title: string
  message: string
  testRunId?: string
  status: AlertStatus
}

export interface CalibrationRecord {
  id: string
  date: string
  parameter: Exclude<SensorParameter, 'totalVolume'>
  stage: SensorStage
  model: string
  referenceValue: number
  sensorReading: number
  unit: string
  status: 'Record Available' | 'Review Needed'
  notes: string
}

export interface LaboratoryValidationRecord {
  id: string
  date: string
  testRunId: string
  sampleId: string
  stage: SensorStage
  parameter: Exclude<SensorParameter, 'flowRate' | 'totalVolume'>
  referenceResult?: number
  sensorReading: number
  unit: string
  status: RecordStatus
  conclusion?: string
  notes: string
}

export interface MaintenanceRecord {
  id: string
  date: string
  component: string
  type: 'Inspection' | 'Service' | 'Replacement'
  description: string
  status: 'Completed' | 'Review Needed'
  performedBy: string
  notes: string
}

export interface MaintenanceReminder {
  id: string
  component: string
  label: string
  dueDate: string
  status: 'Due' | 'Upcoming'
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: 'Active' | 'Inactive'
}

export type UserRecord = User

export interface DeviceStatus {
  deviceId: string
  controller: string
  connection: DeviceConnectionState
  wifiConnection: 'Connected' | 'Disconnected' | 'Not Configured'
  failSafeControl: 'Pending Hardware Integration' | 'Local Control Active'
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
  notifications: NotificationPreferences
}

export interface TelemetryChartPoint {
  time: string
  before: number
  after: number
}

export type ResourceStatus = 'loading' | 'success' | 'empty' | 'error' | 'stale'

export interface CreateTestRunInput {
  sampleInformation?: string
  notes?: string
}

export interface CreateCalibrationRecordInput {
  parameter: CalibrationRecord['parameter']
  stage: SensorStage
  referenceValue: number
  sensorReading: number
}

export interface CreateLaboratoryValidationRecordInput {
  testRunId: string
  sampleId: string
  referenceResult?: number
}

export interface CreateMaintenanceRecordInput {
  component: string
  notes?: string
}
