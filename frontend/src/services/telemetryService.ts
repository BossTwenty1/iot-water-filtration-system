import { currentReadings,historyChartData,telemetryRecords } from '../data/mock/telemetryMock'
import type { SensorReading,TelemetryChartPoint,TelemetryRecord } from '../types'
import { clone } from './mockStore'

export interface TelemetryService {
  getLatestTelemetry():Promise<SensorReading[]>
  getTelemetryHistory():Promise<TelemetryRecord[]>
  getTelemetryChart():Promise<TelemetryChartPoint[]>
}

export const telemetryService:TelemetryService={
  getLatestTelemetry:async()=>clone(currentReadings),
  getTelemetryHistory:async()=>clone(telemetryRecords),
  getTelemetryChart:async()=>clone(historyChartData),
}
