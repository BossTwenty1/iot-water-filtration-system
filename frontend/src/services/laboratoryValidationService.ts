import type { CreateLaboratoryValidationRecordInput,LaboratoryValidationRecord } from '../types'
import { apiRequest } from './apiClient'

export interface LaboratoryValidationService {
  getLaboratoryValidationRecords():Promise<LaboratoryValidationRecord[]>
  createLaboratoryValidationRecord(input:CreateLaboratoryValidationRecordInput):Promise<LaboratoryValidationRecord>
}

export const laboratoryValidationService:LaboratoryValidationService={
  getLaboratoryValidationRecords:()=>apiRequest<LaboratoryValidationRecord[]>('laboratory-validation'),
  createLaboratoryValidationRecord:(input)=>apiRequest<LaboratoryValidationRecord>('laboratory-validation',{method:'POST',body:input}),
}
