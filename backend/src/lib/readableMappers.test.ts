import { describe, expect, it } from 'vitest'
import { groupReadingsIntoTelemetry, toAlert, toDeviceStatus, toTestRun, toUser, toLaboratoryValidationRecord, toMaintenanceRecord, toMaintenanceReminder, toCalibrationRecord } from './mappers'
import type { AlertRow, SensorReadingWithSensor, TestRunRow, DeviceRow, LaboratoryValidationRecordRow, MaintenanceRecordWithPerformer, MaintenanceReminderRow, CalibrationRecordWithSensor } from '../types/db'

describe('readable IDs keep UUID record links intact', () => {
  const testId='fb9f5e84-ada9-4277-bb01-95b8a131c3cb'
  const deviceId='fd40bedb-1da3-4194-ae15-7de3698b1f7a'
  it('uses the same test number for the test, its alert, and its grouped readings', () => {
    const test=toTestRun({id:testId,display_number:7} as TestRunRow & Parameters<typeof toTestRun>[0])
    const alert=toAlert({id:'alert-uuid',test_run_id:testId,display_number:3,test_run:{display_number:7}} as AlertRow)
    const record=groupReadingsIntoTelemetry([{
      device_id:deviceId,test_run_id:testId,measured_at:'2026-10-27T00:00:00Z',
      test_run:{display_number:7},device:{display_number:2},sensor:{category:'ph',position:'pre_filtration',unit:'pH'},value:6.77,
    } as SensorReadingWithSensor])[0]!
    expect(test.id).toBe(testId)
    expect(test.displayId).toBe('Test 0007')
    expect(alert.id).toBe('alert-uuid')
    expect(alert.testRunId).toBe(testId)
    expect(alert.displayId).toBe('Alert 0003')
    expect(alert.testRunDisplayId).toBe(test.displayId)
    expect(record.testRunId).toBe(testId)
    expect(record.deviceId).toBe(deviceId)
    expect(record.testRunDisplayId).toBe(test.displayId)
    expect(record.id).toBe(`${deviceId}|${testId}|2026-10-27T00:00:00Z`)
    expect(record.before.pH).toBe(6.77)
    expect(toDeviceStatus({id:deviceId,display_number:2} as DeviceRow).displayId).toBe(record.deviceDisplayId)
  })
  it('keeps absent links and supplied sample references unchanged', () => {
    const record=toLaboratoryValidationRecord({id:'lab-uuid',display_number:1,test_run_id:null,sample_reference:'EXTERNAL-SAMPLE-01',results:null,percentage_error:null} as LaboratoryValidationRecordRow)
    expect(record.displayId).toBe('Lab record 0001')
    expect(record.testRunId).toBeNull()
    expect(record.testRunDisplayId).toBeUndefined()
    expect(record.sampleId).toBe('EXTERNAL-SAMPLE-01')
  })
  it('labels maintenance, reminders and sensor checks without changing IDs', () => {
    expect(toMaintenanceRecord({id:'maintenance-uuid',display_number:5} as MaintenanceRecordWithPerformer)).toMatchObject({id:'maintenance-uuid',displayId:'Maintenance 0005'})
    expect(toMaintenanceReminder({id:'reminder-uuid',display_number:4} as MaintenanceReminderRow)).toMatchObject({id:'reminder-uuid',displayId:'Reminder 0004'})
    expect(toCalibrationRecord({id:'check-uuid',display_number:2} as CalibrationRecordWithSensor)).toMatchObject({id:'check-uuid',displayId:'Sensor check 0002'})
  })
  it('uses a user number as the name fallback, never a UUID', () => {
    expect(toUser({id:'user-uuid',display_number:1})).toMatchObject({id:'user-uuid',displayId:'User 0001',name:'User 0001'})
    expect(toUser({id:'user-uuid',full_name:'Nash',display_number:1}).name).toBe('Nash')
  })
})
