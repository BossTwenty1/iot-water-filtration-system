import { calibrationMock } from '../data/mock/recordsMock'
import type { CalibrationRecord,CreateCalibrationRecordInput } from '../types'
import { clone } from './mockStore'

let records=clone(calibrationMock)
const sensorDetails:Record<CalibrationRecord['parameter'],{model:string;unit:string}>={pH:{model:'PH-4502C',unit:'pH'},turbidity:{model:'Pending Confirmation',unit:'NTU'},TDS:{model:'DFRobot TDS',unit:'ppm'},temperature:{model:'DS18B20',unit:'°C'},flowRate:{model:'ZJ-S201C',unit:'L/min'}}

export interface CalibrationService {
  getCalibrationRecords():Promise<CalibrationRecord[]>
  createCalibrationRecord(input:CreateCalibrationRecordInput):Promise<CalibrationRecord>
}

export const calibrationService:CalibrationService={
  getCalibrationRecords:async()=>clone(records),
  createCalibrationRecord:async(input)=>{const details=sensorDetails[input.parameter];const record:CalibrationRecord={id:`CAL-2026-${String(records.length+1).padStart(3,'0')}`,date:new Date().toISOString(),...input,...details,status:'Record Available',notes:'Calibration record created. Method details require research-team approval.'};records=[record,...records];return clone(record)},
}
