// Convenience aliases over the generated `Database` type
// (src/types/database.types.ts, produced by
// `npx supabase gen types typescript --local` — regenerate after any schema
// migration).
import type { Database } from './database.types'

type PublicTables = Database['public']['Tables']

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

export type DeviceRow = Tables<'devices'>
export type SensorRow = Tables<'sensors'>
export type TestRunRow = Tables<'test_runs'>
export type AlertRow = Tables<'alerts'>
export type AlertStateChangeRow = Tables<'alert_state_changes'>
export type CalibrationRecordRow = Tables<'calibration_records'>
export type SensorReadingRow = Tables<'sensor_readings'>
export type LaboratoryValidationRecordRow = Tables<'laboratory_validation_records'>
export type ProfileRow = Tables<'profiles'>
export type MaintenanceRecordRow = Tables<'maintenance_records'>
export type MaintenanceReminderRow = Tables<'maintenance_reminders'>
export type AppSettingsRow = Tables<'app_settings'>
export type ThresholdRow = Tables<'thresholds'>
export type NotificationProviderRow = Tables<'notification_providers'>
export type DataRetentionPolicyRow = Tables<'data_retention_policy'>

// Shape returned when a query embeds the owning sensor's display fields —
// used everywhere a reading/calibration row is joined to `sensors`.
export type SensorSummary = Pick<SensorRow, 'category' | 'position' | 'unit'>
export type SensorReadingWithSensor = SensorReadingRow & { sensor: SensorSummary | null }
export type CalibrationRecordWithSensor = CalibrationRecordRow & { sensor: SensorSummary | null }
export type MaintenanceRecordWithPerformer = MaintenanceRecordRow & {
  performer: Pick<ProfileRow, 'full_name' | 'email'> | null
}
