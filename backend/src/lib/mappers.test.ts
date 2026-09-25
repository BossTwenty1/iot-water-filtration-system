import { describe, expect, it } from 'vitest'
import {
  categoryToParameter,
  groupReadingsIntoTelemetry,
  parameterToCategory,
  positionToStage,
  stageToPosition,
  toDeviceStatus,
  VALID_CATEGORIES,
  VALID_POSITIONS,
} from './mappers'
import type { SensorReadingWithSensor } from '../types/db'
import type { DeviceRow } from '../types/db'

describe('category/position round-trips', () => {
  it('round-trips every valid category through parameter and back', () => {
    for (const category of VALID_CATEGORIES) {
      expect(parameterToCategory(categoryToParameter(category))).toBe(category)
    }
  })

  it('round-trips every valid position through stage and back', () => {
    for (const position of VALID_POSITIONS) {
      expect(stageToPosition(positionToStage(position))).toBe(position)
    }
  })
})

function reading(overrides: Partial<SensorReadingWithSensor> & { category: string; position: string }): SensorReadingWithSensor {
  const { category, position, ...rest } = overrides
  return {
    id: 'reading-id',
    device_id: 'device-1',
    sensor_id: 'sensor-1',
    test_run_id: null,
    calibration_id: null,
    measured_at: '2026-09-20T00:00:00.000Z',
    received_at: '2026-09-20T00:00:00.000Z',
    created_at: '2026-09-20T00:00:00.000Z',
    reading_status: null,
    value: 7,
    sensor: { category, position, unit: 'pH' },
    ...rest,
  } as SensorReadingWithSensor
}

describe('groupReadingsIntoTelemetry', () => {
  it('groups pre/post readings sharing device/testRun/measuredAt into one record', () => {
    const rows: SensorReadingWithSensor[] = [
      reading({ category: 'ph', position: 'pre_filtration', value: 6.5 }),
      reading({ category: 'ph', position: 'post_filtration', value: 7.1 }),
    ]
    const record = groupReadingsIntoTelemetry(rows)[0]!
    expect(record.deviceId).toBe('device-1')
    expect(record.before.pH).toBe(6.5)
    expect(record.after.pH).toBe(7.1)
  })

  it('splits into separate records when measuredAt differs', () => {
    const rows: SensorReadingWithSensor[] = [
      reading({ category: 'ph', position: 'pre_filtration', value: 6.5, measured_at: '2026-09-20T00:00:00.000Z' }),
      reading({ category: 'ph', position: 'pre_filtration', value: 6.6, measured_at: '2026-09-20T00:00:30.000Z' }),
    ]
    expect(groupReadingsIntoTelemetry(rows)).toHaveLength(2)
  })

  it('skips a reading whose value is null without crashing', () => {
    const rows: SensorReadingWithSensor[] = [reading({ category: 'ph', position: 'pre_filtration', value: null })]
    const record = groupReadingsIntoTelemetry(rows)[0]!
    expect(record.before.pH).toBeUndefined()
  })

  it('sorts groups newest-first by timestamp', () => {
    const rows: SensorReadingWithSensor[] = [
      reading({ category: 'ph', position: 'pre_filtration', measured_at: '2026-09-20T00:00:00.000Z' }),
      reading({ category: 'ph', position: 'pre_filtration', measured_at: '2026-09-20T00:01:00.000Z' }),
    ]
    const records = groupReadingsIntoTelemetry(rows)
    expect(records[0]!.timestamp).toBe('2026-09-20T00:01:00.000Z')
    expect(records[1]!.timestamp).toBe('2026-09-20T00:00:00.000Z')
  })
})

describe('toDeviceStatus', () => {
  it('falls back to placeholder labels when hardware fields are unset', () => {
    const row = {
      id: 'device-1',
      controller_name: null,
      name: null,
      connection_state: null,
      wifi_state: null,
      fail_safe_state: null,
      last_seen_at: null,
    } as unknown as DeviceRow

    const status = toDeviceStatus(row)
    expect(status.controller).toBe('Unknown Controller')
    expect(status.connection).toBe('Pending Hardware Integration')
    expect(status.wifiConnection).toBe('Not Configured')
    expect(status.failSafeControl).toBe('Pending Hardware Integration')
  })

  it('falls back to latestReadingAt for lastUpdatedAt when last_seen_at is unset', () => {
    const row = {
      id: 'device-1',
      controller_name: 'ESP32-001',
      name: null,
      connection_state: 'Online',
      wifi_state: 'Connected',
      fail_safe_state: 'Normal',
      last_seen_at: null,
      latestReadingAt: '2026-09-20T00:00:00.000Z',
    } as unknown as DeviceRow & { latestReadingAt: string }

    expect(toDeviceStatus(row).lastUpdatedAt).toBe('2026-09-20T00:00:00.000Z')
  })
})
