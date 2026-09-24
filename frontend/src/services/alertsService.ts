import { alertsMock } from '../data/mock/recordsMock'
import type { SystemAlert } from '../types'
import { clone } from './mockStore'

let alerts=clone(alertsMock)

export interface AlertsService {
  getAlerts():Promise<SystemAlert[]>
  acknowledgeAlert(id:string):Promise<SystemAlert>
  resolveAlert(id:string):Promise<SystemAlert>
}

const updateStatus=async(id:string,status:SystemAlert['status'])=>{
  const alert=alerts.find((item)=>item.id===id)
  if(!alert)throw new Error('Alert record was not found.')
  alert.status=status
  return clone(alert)
}

export const alertsService:AlertsService={
  getAlerts:async()=>clone(alerts),
  acknowledgeAlert:(id)=>updateStatus(id,'Acknowledged'),
  resolveAlert:(id)=>updateStatus(id,'Resolved'),
}
