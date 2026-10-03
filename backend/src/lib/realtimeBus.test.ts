import { describe, it, expect, vi } from 'vitest'
import { realtimeBus } from './realtimeBus'
import type { TelemetryRecord, SystemAlert, DeviceStatus, TestRun } from '../types/domain'

describe('realtimeBus', () => {
  it('emits telemetry events to subscribers', () => {
    const callback = vi.fn()
    realtimeBus.on('telemetry', callback)

    const sampleTelemetry: TelemetryRecord[] = [
      {
        id: 'test-device||2026-10-03T10:00:00Z',
        timestamp: '2026-10-03T10:00:00Z',
        testRunId: null,
        deviceId: 'test-device',
        before: { pH: 7.2, turbidity: 12.5 },
        after: { pH: 7.1, turbidity: 0.8 },
      },
    ]

    realtimeBus.emitTelemetry(sampleTelemetry)
    expect(callback).toHaveBeenCalledWith(sampleTelemetry)
    realtimeBus.off('telemetry', callback)
  })

  it('emits alert events to subscribers', () => {
    const callback = vi.fn()
    realtimeBus.on('alert', callback)

    const sampleAlerts: SystemAlert[] = [
      {
        id: 'alert-1',
        timestamp: '2026-10-03T10:00:00Z',
        severity: 'Warning',
        source: 'Pre-Filtration Turbidity Sensor',
        title: 'High Turbidity',
        message: 'High turbidity reading detected.',
        status: 'Active',
      },
    ]

    realtimeBus.emitAlert(sampleAlerts)
    expect(callback).toHaveBeenCalledWith(sampleAlerts)
    realtimeBus.off('alert', callback)
  })

  it('emits device status events to subscribers', () => {
    const callback = vi.fn()
    realtimeBus.on('device', callback)

    const sampleDevice: DeviceStatus = {
      deviceId: 'ESP32-DEV-001',
      controller: 'ESP32-WROOM-32',
      connection: 'Online',
      wifiConnection: 'Connected',
      failSafeControl: 'Local Control Active',
    }

    realtimeBus.emitDevice(sampleDevice)
    expect(callback).toHaveBeenCalledWith(sampleDevice)
    realtimeBus.off('device', callback)
  })

  it('emits test run events to subscribers', () => {
    const callback = vi.fn()
    realtimeBus.on('test_run', callback)

    const sampleRun: TestRun = {
      id: 'run-123',
      startedAt: '2026-10-03T10:00:00Z',
      duration: '05m 12s',
      processedVolume: 15.5,
      status: 'In Progress',
      telemetryCount: 42,
      alertCount: 0,
      validationStatus: 'Pending',
      notes: 'Test run in progress',
    }

    realtimeBus.emitTestRun(sampleRun)
    expect(callback).toHaveBeenCalledWith(sampleRun)
    realtimeBus.off('test_run', callback)
  })
})
