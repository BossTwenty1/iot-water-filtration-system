import type { SensorReading,SensorStage,TelemetryChartPoint,TelemetryRecord } from '../types'
import { apiRequest } from './apiClient'

export interface TelemetryService {
  getLatestTelemetry():Promise<SensorReading[]>
  getTelemetryHistory():Promise<TelemetryRecord[]>
  getTelemetryChart():Promise<TelemetryChartPoint[]>
}

// Confirmed physical boards for this installation. Keep simulated and unrelated
// boards out of the comparison, including before the API applies its row limit.
const boardDeviceIds:Record<SensorStage,string>={
  before:'d4b1601b-9355-4203-ac6e-2b84b28cbf50',
  after:'cb06c51a-83db-4940-b6cc-19f6d52fcde7',
}

export async function getBoardTelemetry(stage:SensorStage,signal:AbortSignal){
  const deviceId=boardDeviceIds[stage]
  const records=await apiRequest<TelemetryRecord[]>(`telemetry?stage=${stage}&deviceId=${deviceId}&limit=200`,{signal,cache:'no-store'})
  return records.filter(record=>record.deviceId===deviceId)
}

// Latest reading per sensor from the confirmed boards only: the before stage
// from the pre-filtration board and the after stage from the post-filtration
// board. Unfiltered telemetry/current returns every device's sensors, so a
// simulated or extra board would add a second set of cards for a stage.
export async function getLatestBoardReadings(){
  const stages=await Promise.all((['before','after'] as const).map(async stage=>{
    const readings=await apiRequest<SensorReading[]>(`telemetry/current?deviceId=${boardDeviceIds[stage]}`)
    return readings.filter(reading=>reading.stage===stage)
  }))
  return stages.flat()
}

export const telemetryService:TelemetryService={
  getLatestTelemetry:getLatestBoardReadings,
  getTelemetryHistory:()=>apiRequest<TelemetryRecord[]>('telemetry'),
  getTelemetryChart:()=>apiRequest<TelemetryChartPoint[]>('telemetry/chart?parameter=turbidity'),
}
