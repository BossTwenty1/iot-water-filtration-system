import type { CalibrationRecord,CreateCalibrationRecordInput } from '../types'
import { apiRequest } from './apiClient'

export interface CalibrationService {
  getCalibrationRecords():Promise<CalibrationRecord[]>
  createCalibrationRecord(input:CreateCalibrationRecordInput):Promise<CalibrationRecord>
}

export const calibrationService:CalibrationService={
  getCalibrationRecords:()=>apiRequest<CalibrationRecord[]>('calibration'),
  createCalibrationRecord:(input)=>apiRequest<CalibrationRecord>('calibration',{method:'POST',body:input}),
}
