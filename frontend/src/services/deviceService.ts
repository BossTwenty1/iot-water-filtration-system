import type { DeviceStatus } from '../types'
import { apiRequest } from './apiClient'

interface DeviceRow { id:string; is_simulated?:boolean | null }
export interface DeviceService { getDeviceStatus():Promise<DeviceStatus|null> }
export const deviceService:DeviceService={
  getDeviceStatus:async()=>{
    const devices=await apiRequest<DeviceRow[]>('devices')
    if(!devices.length)return null
    const status=await apiRequest<DeviceStatus>(`devices/${encodeURIComponent(devices[0].id)}/status`)
    return {...status,isSimulated:devices[0].is_simulated===true}
  },
}
