import type { SystemAlert } from '../types'
import { apiRequest } from './apiClient'

export interface AlertsService {
  getAlerts():Promise<SystemAlert[]>
  acknowledgeAlert(id:string):Promise<SystemAlert>
  resolveAlert(id:string):Promise<SystemAlert>
}

export const alertsService:AlertsService={
  getAlerts:()=>apiRequest<SystemAlert[]>('alerts'),
  acknowledgeAlert:(id)=>apiRequest<SystemAlert>(`alerts/${encodeURIComponent(id)}/acknowledge`,{method:'PATCH'}),
  resolveAlert:(id)=>apiRequest<SystemAlert>(`alerts/${encodeURIComponent(id)}/resolve`,{method:'PATCH'}),
}
