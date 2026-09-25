import type { AppSettings,DeviceStatus } from '../../types'

export const appSettingsMock:AppSettings={
  systemName:'IoT Embedded Water Filtration System',
  deviceDisplayName:'ESP32-001',
  timezone:'Asia/Manila (UTC+08:00)',
  dateFormat:'YYYY-MM-DD',
  timeFormat:'24-Hour (UTC)',
  notifications:{offline:true,sensor:true,noFlow:true,waterQuality:true,pump:false,uvc:false,maintenance:true},
}

export const deviceStatusMock:DeviceStatus={
  deviceId:'ESP32-001',
  controller:'ESP32-WROOM-32',
  connection:'Online',
  wifiConnection:'Connected',
  failSafeControl:'Pending Hardware Integration',
  lastUpdatedAt:'2026-09-30T14:42:19+08:00',
}
