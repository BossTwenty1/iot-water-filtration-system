import { deviceStatusMock } from '../data/mock/systemMock'
import type { DeviceStatus } from '../types'
import { clone } from './mockStore'

export interface DeviceService { getDeviceStatus():Promise<DeviceStatus> }
export const deviceService:DeviceService={getDeviceStatus:async()=>clone(deviceStatusMock)}
