import { maintenanceMock,maintenanceReminders } from '../data/mock/recordsMock'
import type { CreateMaintenanceRecordInput,MaintenanceRecord,MaintenanceReminder } from '../types'
import { clone } from './mockStore'

let records=clone(maintenanceMock)

export interface MaintenanceService {
  getMaintenanceRecords():Promise<MaintenanceRecord[]>
  getMaintenanceReminders():Promise<MaintenanceReminder[]>
  createMaintenanceRecord(input:CreateMaintenanceRecordInput):Promise<MaintenanceRecord>
}

export const maintenanceService:MaintenanceService={
  getMaintenanceRecords:async()=>clone(records),
  getMaintenanceReminders:async()=>clone(maintenanceReminders),
  createMaintenanceRecord:async(input)=>{const record:MaintenanceRecord={id:`MNT-2026-${String(records.length+1).padStart(3,'0')}`,date:new Date().toISOString(),component:input.component,type:'Inspection',description:'Inspection record created.',status:'Completed',performedBy:'Administrator',notes:input.notes?.trim()||'No parts or materials recorded.'};records=[record,...records];return clone(record)},
}
