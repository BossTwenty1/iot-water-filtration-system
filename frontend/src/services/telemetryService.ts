import type { SensorReading,TelemetryChartPoint,TelemetryRecord } from '../types'
import { apiRequest } from './apiClient'

export interface TelemetryService {
  getLatestTelemetry():Promise<SensorReading[]>
  getTelemetryHistory():Promise<TelemetryRecord[]>
  getTelemetryChart():Promise<TelemetryChartPoint[]>
}

// Query each stage independently so a busy board cannot crowd the other out
// of the global history limit. These are independent records, not a paired sample.
export async function getLatestBoardRecords(){
  const [before,after]=await Promise.all([
    apiRequest<TelemetryRecord[]>('telemetry?stage=before&limit=10'),
    apiRequest<TelemetryRecord[]>('telemetry?stage=after&limit=10'),
  ])
  return {before:before[0]??null,after:after[0]??null}
}

export const telemetryService:TelemetryService={
  getLatestTelemetry:()=>apiRequest<SensorReading[]>('telemetry/current'),
  getTelemetryHistory:()=>apiRequest<TelemetryRecord[]>('telemetry'),
  getTelemetryChart:()=>apiRequest<TelemetryChartPoint[]>('telemetry/chart?parameter=turbidity'),
}
