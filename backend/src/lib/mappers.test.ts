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

describe('groupReadingsIntoTelemetry — two-board pairing', () => {
  const INSTALLATION = 'installation-1'
  const T0 = '2026-11-18T03:37:00.000Z'

  // Synthetic two-board fixtures: device-pre reports pre_filtration only,
  // device-post reports post_filtration only.
  function pre(measuredAt: string, value: number | null = 6.7, installation: string | null = INSTALLATION) {
    return reading({ category: 'ph', position: 'pre_filtration', value, measured_at: measuredAt, device_id: 'device-pre', device: { display_number: 6, installation_id: installation } })
  }
  function post(measuredAt: string, value: number | null = 7.0, installation: string | null = INSTALLATION) {
    return reading({ category: 'ph', position: 'post_filtration', value, measured_at: measuredAt, device_id: 'device-post', device: { display_number: 7, installation_id: installation } })
  }
  const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString()

  it('merges slot-aligned boards with identical measuredAt into one exact row', () => {
    const records = groupReadingsIntoTelemetry([pre(T0), post(T0)])
    expect(records).toHaveLength(1)
    const record = records[0]!
    expect(record.pairing).toBe('exact')
    expect(record.before.pH).toBe(6.7)
    expect(record.after.pH).toBe(7.0)
    expect(record.beforeDeviceId).toBe('device-pre')
    expect(record.afterDeviceId).toBe('device-post')
    expect(record.deviceDisplayId).toBe('Device 0006 + Device 0007')
    expect(record.pairGapSeconds).toBe(0)
    expect(record.id).toBe(`device-pre||${T0}~device-post||${T0}`)
  })

  it('pairs unaligned cycles within the tolerance and reports the gap', () => {
    const [record] = groupReadingsIntoTelemetry([pre(at(13)), post(at(0))])
    expect(record!.pairing).toBe('nearest')
    expect(record!.pairGapSeconds).toBe(-13)
    expect(record!.timestamp).toBe(at(13))
    expect(record!.afterMeasuredAt).toBe(at(0))
  })

  it('leaves cycles further apart than the tolerance as unpaired half rows', () => {
    const records = groupReadingsIntoTelemetry([pre(at(0)), post(at(45))], { pairToleranceMs: 30_000 })
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.pairing === 'unpaired')).toBe(true)
    expect(records.find((r) => r.beforeDeviceId)!.after).toEqual({})
  })

  it('only pairs exact matches when the tolerance is 0', () => {
    const records = groupReadingsIntoTelemetry([pre(at(0)), post(at(1))], { pairToleranceMs: 0 })
    expect(records.map((r) => r.pairing)).toEqual(['unpaired', 'unpaired'])
  })

  it('uses each cycle at most once and prefers the closest partner', () => {
    // pre@0 and pre@60 each have a post partner; post@58 must go to pre@60, not pre@0.
    const records = groupReadingsIntoTelemetry([pre(at(0)), pre(at(60)), post(at(2)), post(at(58))])
    expect(records).toHaveLength(2)
    expect(records.map((r) => [r.beforeMeasuredAt, r.afterMeasuredAt])).toEqual([
      [at(60), at(58)],
      [at(0), at(2)],
    ])
  })

  it('does not carry an older value forward into a missing side', () => {
    const records = groupReadingsIntoTelemetry([pre(at(0)), post(at(0)), pre(at(60))])
    const latest = records[0]!
    expect(latest.pairing).toBe('unpaired')
    expect(latest.after).toEqual({})
  })

  it('keeps a fault cycle (all values null) in its slot instead of pairing it elsewhere', () => {
    const records = groupReadingsIntoTelemetry([pre(at(0), null), post(at(0))])
    expect(records).toHaveLength(1)
    expect(records[0]!.pairing).toBe('exact')
    expect(records[0]!.before).toEqual({})
    expect(records[0]!.after.pH).toBe(7.0)
  })

  it('never pairs boards from different installations or devices without an installation', () => {
    expect(groupReadingsIntoTelemetry([pre(T0), post(T0, 7.0, 'installation-2')])).toHaveLength(2)
    const unassigned = groupReadingsIntoTelemetry([pre(T0, 6.7, null), post(T0, 7.0, null)])
    expect(unassigned).toHaveLength(2)
    expect(unassigned.every((r) => r.pairing === 'single-device')).toBe(true)
  })

  it('never pairs across test runs', () => {
    const records = groupReadingsIntoTelemetry([
      { ...pre(T0), test_run_id: 'run-1' },
      { ...post(T0), test_run_id: 'run-2' },
    ])
    expect(records).toHaveLength(2)
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
