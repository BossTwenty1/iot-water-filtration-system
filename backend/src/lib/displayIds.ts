export type DisplayIdKind = 'Test' | 'Device' | 'Alert' | 'Sensor check' | 'Lab record' | 'Maintenance' | 'Reminder' | 'User'

export interface NumberedRecord { display_number?: number }
export interface TestRunReference { test_run?: NumberedRecord | null }

export function displayId(kind: DisplayIdKind, number: number | undefined): string | undefined {
  if (!Number.isSafeInteger(number) || (number ?? 0) < 1) return undefined
  return `${kind} ${String(number).padStart(4, '0')}`
}
