import type { SensorReading,TelemetryChartPoint,TelemetryRecord } from '../types'
import { apiRequest } from './apiClient'

export interface TelemetryService {
  getLatestTelemetry():Promise<SensorReading[]>
  getTelemetryHistory():Promise<TelemetryRecord[]>
  getTelemetryChart():Promise<TelemetryChartPoint[]>
}

export const telemetryService:TelemetryService={
  getLatestTelemetry:()=>apiRequest<SensorReading[]>('telemetry/current'),
  getTelemetryHistory:()=>apiRequest<TelemetryRecord[]>('telemetry'),
  getTelemetryChart:()=>apiRequest<TelemetryChartPoint[]>('telemetry/chart?parameter=turbidity'),
}
