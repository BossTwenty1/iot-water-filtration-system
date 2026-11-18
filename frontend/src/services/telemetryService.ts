import type { SensorReading,SensorStage,TelemetryChartPoint,TelemetryRecord } from '../types'
import { apiRequest } from './apiClient'

export interface TelemetryService {
  getLatestTelemetry():Promise<SensorReading[]>
  getTelemetryHistory():Promise<TelemetryRecord[]>
  getTelemetryChart():Promise<TelemetryChartPoint[]>
}

// A separate limit for each stage keeps a busy board from hiding the other.
export function getBoardTelemetry(stage:SensorStage,signal:AbortSignal){
  return apiRequest<TelemetryRecord[]>(`telemetry?stage=${stage}&limit=200`,{signal,cache:'no-store'})
}

export const telemetryService:TelemetryService={
  getLatestTelemetry:()=>apiRequest<SensorReading[]>('telemetry/current'),
  getTelemetryHistory:()=>apiRequest<TelemetryRecord[]>('telemetry'),
  getTelemetryChart:()=>apiRequest<TelemetryChartPoint[]>('telemetry/chart?parameter=turbidity'),
}
