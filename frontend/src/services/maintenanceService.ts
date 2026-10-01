import type { CreateMaintenanceRecordInput,MaintenanceRecord,MaintenanceReminder } from '../types'
import { apiRequest } from './apiClient'

export interface MaintenanceService {
  getMaintenanceRecords():Promise<MaintenanceRecord[]>
  getMaintenanceReminders():Promise<MaintenanceReminder[]>
  createMaintenanceRecord(input:CreateMaintenanceRecordInput):Promise<MaintenanceRecord>
}

export const maintenanceService:MaintenanceService={
  getMaintenanceRecords:()=>apiRequest<MaintenanceRecord[]>('maintenance/records'),
  getMaintenanceReminders:()=>apiRequest<MaintenanceReminder[]>('maintenance/reminders'),
  createMaintenanceRecord:(input)=>apiRequest<MaintenanceRecord>('maintenance/records',{method:'POST',body:input}),
}
