import { EventEmitter } from 'node:events'
import type { TelemetryRecord, SystemAlert, DeviceStatus, TestRun } from '../types/domain'

class RealtimeBus extends EventEmitter {
  emitTelemetry(records: TelemetryRecord[]) {
    this.emit('telemetry', records)
  }

  emitAlert(alerts: SystemAlert[]) {
    this.emit('alert', alerts)
  }

  emitDevice(status: DeviceStatus) {
    this.emit('device', status)
  }

  emitTestRun(run: TestRun) {
    this.emit('test_run', run)
  }
}

export const realtimeBus = new RealtimeBus()
// Allow multiple concurrent browser sessions without node memory leak warnings
realtimeBus.setMaxListeners(200)
