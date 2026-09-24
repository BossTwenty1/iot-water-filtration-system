import { laboratoryValidationMock } from '../data/mock/recordsMock'
import type { CreateLaboratoryValidationRecordInput,LaboratoryValidationRecord } from '../types'
import { clone } from './mockStore'

let records=clone(laboratoryValidationMock)

export interface LaboratoryValidationService {
  getLaboratoryValidationRecords():Promise<LaboratoryValidationRecord[]>
  createLaboratoryValidationRecord(input:CreateLaboratoryValidationRecordInput):Promise<LaboratoryValidationRecord>
}

export const laboratoryValidationService:LaboratoryValidationService={
  getLaboratoryValidationRecords:async()=>clone(records),
  createLaboratoryValidationRecord:async(input)=>{const record:LaboratoryValidationRecord={id:`VAL-2026-${String(records.length+1).padStart(3,'0')}`,date:new Date().toISOString(),...input,stage:'after',parameter:'turbidity',sensorReading:.72,unit:'NTU',status:input.referenceResult===undefined?'Pending':'Available',notes:input.referenceResult===undefined?'External laboratory/reference result pending.':'External laboratory/reference result recorded.'};records=[record,...records];return clone(record)},
}
